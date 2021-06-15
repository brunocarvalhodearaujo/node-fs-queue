/**
 * Copyright (c) 2021-present, Bruno Carvalho de Araujo.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import { Maildir, STATUS } from './Maildir'

type Options = {
  persistent: boolean,
  path: string
}

export type QueueCallback = (error: Error, callback?: {
  payload: any,
  next: () => any,
  commit: () => Promise<void>,
  rollback: () => Promise<void>
}) => void

export class Channel {
  private maildir: Maildir

  constructor (protected options: Options) {
    this.maildir = new Maildir(options.path)
    // be notified, when new messages are available
    this.maildir.on('new', messages => {
      // console.info(messages)
      // this.laterPop.push(...messages)
    })
    // Create the queue with the given path
    this.maildir.create(options.persistent)
  }

  get length () {
    return this.maildir.size(STATUS.NEW)
  }

  get isRunning() {
    return !!this.maildir.watcher
  }

  push (message: any, priority?: number) {
    return this.maildir.newFile(message, priority)
  }

  stop () {
    return this.maildir.stopWatching()
  }

  /**
   * Pops one item in a transaction from the queue
   */
  async pop (status: STATUS = STATUS.NEW) {
    try {
      const [message] = await this.maildir.listWith(status)

      if (message) {
        return this.maildir.process(message)
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }
}
