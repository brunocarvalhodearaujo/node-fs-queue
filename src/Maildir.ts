/**
 * Copyright (c) 2021-present, Bruno Carvalho de Araujo.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import fs, { FSWatcher } from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { hostname } from 'os'
import { EventEmitter } from 'events'

export enum STATUS {
  TMP = 'temp',
  NEW = 'new',
  CUR = 'inprocess',
  ERR = 'error'
}

export class Maildir {
  private pushed = 0
  private dirPaths: { [key:string]: any } = {}
  private events = new EventEmitter()
  public watcher: FSWatcher = null

  constructor (public cwd: string) {
    this.dirPaths[STATUS.TMP] = path.resolve(path.join(cwd, STATUS.TMP))
    this.dirPaths[STATUS.NEW] = path.resolve(path.join(cwd, STATUS.NEW))
    this.dirPaths[STATUS.CUR] = path.resolve(path.join(cwd, STATUS.CUR))
    this.dirPaths[STATUS.ERR] = path.resolve(path.join(cwd, STATUS.ERR))
  }

  size (status: STATUS) {
    return fs.readdirSync(this.dirPaths[status]).length
  }

  generateId (priority: number = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      const time = (new Date()).getTime()

      crypto.pseudoRandomBytes(8, (error, randomBytes) => {
        if (error) reject(error)
        resolve([
          priority,
          time,
          this.pushed++,
          process.pid,
          randomBytes.readUInt32BE(0),
          randomBytes.readUInt32BE(4),
          hostname()
        ].join('.'))
      })
    })
  }

  /**
   * Creates all folders required for maildir
   */
  create (persistent: boolean = false) {
    for (const dirPath of Object.values(this.dirPaths)) {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }
    }

    if (persistent) {
      this.watcher = fs.watch(this.dirPaths[STATUS.NEW], {}, (error, messages) => {
        this.events.emit('new', [messages])
      })
    }
  }

  stopWatching () {
    if (this.watcher && this.watcher.close) {
      this.watcher.close()
      this.watcher = null
    }
  }

  /**
   * Creates a new message in the new folder
   */
  async newFile (payload: any, priority?: number): Promise<void> {
    return this.generateId(priority).then(uniqueName => new Promise((resolve, reject) => {
      const tmpPath = path.join(this.dirPaths[STATUS.TMP], uniqueName)
      const newPath = path.join(this.dirPaths[STATUS.NEW], uniqueName)

      fs.writeJSON(tmpPath, payload, error => {
        if (error) reject(error)
        else {
          fs.rename(tmpPath, newPath, error => {
            if (error) reject(error)
            else resolve()
          })
        }
      })
    }))
  }

  listWith (status: STATUS) {
    return fs.readdir(this.dirPaths[status])
  }

  async clear () {
    try {
      const files = Object.values(this.dirPaths)
        .map(dirPath => fs.readdirSync(dirPath).map(filename => path.join(dirPath, filename)))
        .reduce((previous, current) => previous.concat(current), [])
        .filter(Boolean)

      for (const filename of files) {
        await fs.unlink(filename)
      }
    } catch (error) {
      return Promise.reject(new Error(`Falha durante a limpeza da fila, motivo: ${error.message}`))
    }
  }

  async changeStatus (message: string, current: STATUS, next: STATUS) {
    try {
      await fs.rename(path.join(this.dirPaths[current], message), path.join(this.dirPaths[next], message))
    } catch (error) {
      return Promise.reject(new Error(`Falha durante a troca de status, motivo: ${error.message}`))
    }
  }

  /**
   * Processes one message from the queue (if possible)
   */
  async process (message: string) {
    const newPath = path.join(this.dirPaths[STATUS.NEW], message)
    const curPath = path.join(this.dirPaths[STATUS.CUR], message)

    try {
      await fs.rename(newPath, curPath)

      return {
        path: path.join(curPath),
        json: () => fs.readJSON(curPath),
        commit: () => fs.unlink(curPath),
        rollback: () => fs.rename(curPath, newPath),
        changeStatus: (status: STATUS) => this.changeStatus(message, STATUS.CUR, status)
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  on (event: string | symbol, listener: (...args: any[]) => void) {
    this.events.on(event, listener)
  }
}
