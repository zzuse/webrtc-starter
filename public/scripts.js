let socket = null
let device = null
let localStream = null
let producerTransport = null
let producer = null
let consumerTransport = null
let consumer = null

const initConnect = () => {
  console.log('1. client init connect')
  // setTimeout(function () {
  //   console.log('blalbabla')
  // }, 3000)
  socket = io('https://localhost:8181')
  connectButton.innerHTML = 'Connecting...'
  connectButton.disabled = true
  addSocketListeners()
}

const deviceSetup = async () => {
  // console.log(mediasoupClient)
  console.log('2. Client Load Device')
  device = new mediasoupClient.Device()
  const routerRtpCapabilities = await socket.emitWithAck('getRtpCap')
  console.log('2.1 Client fetch server capbilities')
  await device.load({ routerRtpCapabilities })
  console.log('2.3 Client device loaded? ' + device.loaded)
  deviceButton.disabled = true
  createProdButton.disabled = false
  createConsButton.disabled = false
  disconnectButton.disabled = false
}

const createProducer = async () => {
  console.log('3. Client create transport')
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    console.log(localStream)
    localVideo.srcObject = localStream
  } catch (err) {
    console.log('GUM error', err)
  }
  const data = await socket.emitWithAck('create-producer-transport')
  console.log('3.1 client request server transport information')
  const { id, iceParameters, iceCandidates, dtlsParameters } = data
  //   console.log(data)
  const transport = device.createSendTransport({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters
  })
  producerTransport = transport
  producerTransport.on(
    'connect',
    async ({ dtlsParameters }, callback, errback) => {
      console.log('4.3 client send dtls info on transport connect event!')
      console.log(dtlsParameters)
      const resp = await socket.emitWithAck('connect-transport', {
        dtlsParameters
      })
      if (resp === 'success') {
        callback()
      } else if (resp === 'error') {
        errback()
      }
      console.log('4.5 client transport connect ' + resp)
    }
  )
  producerTransport.on('produce', async (parameters, callback, errback) => {
    console.log('4.6 client send media onTransport produce event has fired!')
    const { kind, rtpParameters } = parameters
    const resp = await socket.emitWithAck('start-producing', {
      kind,
      rtpParameters
    })
    if (resp === 'error') {
      errback()
    } else {
      callback({ id: resp })
    }
    console.log(resp)
    publishButton.disable = true
    createConsButton.disabled = false
  })
  createProdButton.disabled = true
  publishButton.disabled = false
}

const publish = async () => {
  console.log('4.1 client publish feed')
  const track = localStream.getVideoTracks()[0]
  producer = await producerTransport.produce({ track })
}

const createConsumer = async () => {
  const data = await socket.emitWithAck('create-consumer-transport')
  const { id, iceParameters, iceCandidates, dtlsParameters } = data
  //   console.log(data)
  const transport = device.createRecvTransport({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters
  })
  consumerTransport = transport
  consumerTransport.on('connectionstatechange', state => {
    console.log('....connection state change....')
    console.log(state)
  })
  consumerTransport.on('icegatheringstatechange', state => {
    console.log('....ice gathering change....')
    console.log(state)
  })
  consumerTransport.on(
    'connect',
    async ({ dtlsParameters }, callback, errback) => {
      console.log('5.1 Client Consume connect event has fired!')
      console.log(dtlsParameters)
      const resp = await socket.emitWithAck('connect-consumer-transport', {
        dtlsParameters
      })
      if (resp === 'success') {
        callback()
      } else if (resp === 'error') {
        errback()
      }
      console.log(resp)
    }
  )
  createConsButton.disabled = true
  consumeButton.disabled = false
}

const consume = async () => {
  const consumerParams = await socket.emitWithAck('consume-media', {
    rtpCapabilities: device.rtpCapabilities
  })
  if (consumerParams === 'noProducer') {
    console.log('There is no producer set up to ')
  } else if (consumerParams === 'cannotConsume') {
    console.log('rtpCapabilities failed. Cannot consume')
  } else {
    consumer = await consumerTransport.consume(consumerParams)
    const { track } = consumer
    console.log(track)
    track.addEventListener('ended', () => {
      console.log('track has ended')
    })
    track.onmute = event => {
      console.log('track has muted')
    }
    track.onunmute = event => {
      console.log('track has unmuted')
    }
    remoteVideo.srcObject = new MediaStream([track])
    console.log('Track is live!')
    await socket.emitWithAck('unpauseConsumer')
  }
}

function addSocketListeners () {
  socket.on('connect', () => {
    console.log('1.2 client connected successful')
    connectButton.innerHTML = 'Connected'
    deviceButton.disabled = false
  })
}
