/**
 * Copyright (c) 2021-present, Bruno Carvalho de Araujo.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import { Channel } from './Channel'
import path from 'path'

type Options = {
  cwd: string
}

export class Queue {
  private channels: { [key: string]: Channel } = {}

  constructor (private options: Options) {}

  private hasIndex (index: string): boolean {
    return Object.keys(this.channels).includes(index)
  }

  channel (index: string, persistent: boolean = true) {
    if (!this.hasIndex(index)) {
      this.channels[index] = new Channel({ path: path.join(this.options.cwd, index), persistent })
    }

    return this.channels[index]
  }
}
