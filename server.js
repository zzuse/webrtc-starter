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
  cors: [`https://10.0.0.20:${config.port}`]
})

let workers = null
let router = null
let theProducer = null

const initMediaSoup = async () => {
  workers = await createWorkers()
  console.log('create worker successfully')
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
    console.log('4.4 server get dtlsParameters info and finish connection: ')
    console.log({ dtlsParameters })
    // dtlsParameters.role = 'server'
    try {
      await thisClientProducerTransport.connect(dtlsParameters)
      ack('success')
      console.log('should goto producerTransport.produce, but not')
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
      theProducer = thisClientProducer
      thisClientProducer.on('transportclose', () => {
        console.log('Producer transport closed. Just fyi')
        thisClientProducer.close()
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
    if (!theProducer) {
      ack('noProducer')
    } else if (!router.canConsume({ producerId: theProducer.id })) {
      ack('cannotConsume')
    } else {
      thisClientConsumer = await thisClientConsumerTransport.consume({
        producerId: theProducer.id,
        rtpCapabilities,
        paused: true
      })
      thisClientConsumer.on('transportclose', () => {
        console.log('Consumer transport closed. Just fyi')
        thisClientConsumer.close()
      })
      const consumerParams = {
        producerId: theProducer.id,
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

  socket.on('close-all', ack => {
    try {
      thisClientConsumerTransport?.close()
      thisClientProducerTransport?.close()
      ack('closed')
    } catch (error) {
      ack('closeError')
    }
  })
})

expressServer.listen(config.port)
