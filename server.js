const fs = require('fs')
const https = require('https')

const express = require('express')
const app = express()
// app.use(express.static(__dirname))
app.use(express.static('public'))

//we need a key and cert to run https
//we generated them with mkcert
// $ mkcert create-ca
// $ mkcert create-cert
const key = fs.readFileSync('./config/cert.key')
const cert = fs.readFileSync('./config/cert.crt')
const options = { key, cert }

const socketio = require('socket.io')
const mediasoup = require('mediasoup')
const createWorkers = require('./createWorkers')
const config = require('./config/config')
const createWebRtcTransportBothKinds = require('./createWebRtcTranportBothKinds')

//we changed our express setup so we can use https
//pass the key and cert to createServer on https
const expressServer = https.createServer(options, app)
//create our socket.io server... it will listen to our express port
const io = socketio(expressServer, {
  cors: [`https://localhost:${config.port}`]
  // cors: ['https://10.0.0.200']
})

let workers = null
let router = null
let theProducer = null
const initMediaSoup = async () => {
  workers = await createWorkers()
  console.log(workers)
  router = await workers[0].createRouter({
    mediaCodecs: config.routerMediaCodecs
  })
}

initMediaSoup()

io.on('connect', socket => {
  console.log('1.1 server been connected')
  let thisClientProducerTransport = null
  let thisClientProducer = null
  let thisClientConsumerTransport = null
  let thisClientConsumer = null

  socket.on('getRtpCap', ack => {
    console.log('2.2 server return capabilities')
    ack(router.rtpCapabilities)
  })

  socket.on('create-producer-transport', async ack => {
    console.log('3.2 server return producer transport')
    const { transport, clientTransportParams } =
      await createWebRtcTransportBothKinds(router)
    thisClientProducerTransport = transport
    ack(clientTransportParams)
  })

  socket.on('connect-transport', async (dtlsParameters, ack) => {
    console.log('4.4 server get dtls info and finish connection ')
    try {
      await thisClientProducerTransport.connect(dtlsParameters)
      ack('success')
    } catch (error) {
      console.log(error)
      ack('error')
    }
  })

  socket.on('start-producing', async ({ kind, rtpParameters }, ack) => {
    console.log('4.7 server start producing ')
    try {
      thisClientProducer = await thisClientProducerTransport.produce({
        kind,
        rtpParameters
      })
      ack(thisClientProducer.id)
    } catch (error) {
      ack('error')
    }
  })

  socket.on('create-consumer-transport', async ack => {
    const { transport, clientTransportParams } =
      await createWebRtcTransportBothKinds(router)
    thisClientConsumerTransport = transport
    ack(clientTransportParams)
  })

  socket.on('connect-consumer-transport', async (dtlsParameters, ack) => {
    try {
      await thisClientConsumerTransport.connect(dtlsParameters)
      ack('sucess')
    } catch (error) {
      console.log(error)
      ack('error')
    }
  })

  socket.on('consume-media', async ({ rtpCapabilities }, ack) => {
    console.log('6.2')
    if (!thisClientProducer) {
      ack('noProducer')
    } else if (!router.canConsume({ producerId: thisClientProducer.id })) {
      ack('cannotConsume')
    } else {
      thisClientConsumer = await thisClientConsumerTransport.consume({
        producerId: thisClientProducer.id,
        rtpCapabilities,
        paused: true
      })
      const consumerParams = {
        producerId: thisClientProducer.id,
        id: thisClientConsumer.id,
        kind: thisClientConsumer.kind,
        rtpParameters: thisClientConsumer.rtpCapabilities
      }
      ack(consumerParams)
    }
  })

  socket.on('unpauseConsumer', async ack => {
    await thisClientConsumer.resume()
  })
})

expressServer.listen(config.port)
