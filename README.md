node-fs-queue
=============

## Usage

````ts
import { STATUS } from './Maildir'
import { Channel } from './Channel'
import { Queue } from './Queue'
import path from 'path'

const queue = new Queue({ cwd: path.join(process.cwd(), 'queue') })
const stability = queue.channel('stability')

// cria novos itens
setInterval(async () => {
  // cria prioridade entre 0 e 6
  const priority = Math.floor(Math.random() * 6) + 1
  await stability.push({ now: Date.now(), priority }, priority)
}, 1000)

async function worker (queue: Channel) {
  if (queue.length > 0) {
    const message = await stability.pop()
    const payload = await message.json()

    console.info(payload)

    await message.changeStatus(STATUS.ERR)
  }

  const timeout = (ms: number = 5000) => new Promise(resolve => setTimeout(resolve, ms))

  await (queue.length === 0 ? timeout(5000) : timeout(100))
  await worker(queue)
}

worker(stability)
````
