const os = require('os')
const mediasoup = require('mediasoup')
const totalThreads = os.cpus().length
console.log(totalThreads + ' threads working')
const config = require('./config/config')

const createWorkers = () =>
  new Promise(async (resolve, reject) => {
    let workers = []
    // loop to create each worker
    for (let i = 0; i < totalThreads; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: config.workerSettings.rtcMinPort,
        rtcMaxPort: config.workerSettings.rtcMaxPort,
        logLevel: config.workerSettings.logLevel,
        logTags: config.workerSettings.logTags
      })
      worker.on('died', () => {
        console.log('worker has died')
        process.exit(1)
      })
      workers.push(worker)
    }

    resolve(workers)
  })

module.exports = createWorkers
