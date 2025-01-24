const createWebRtcTransportBothKinds = router =>
  new Promise(async (resolve, reject) => {
    const transport = await router.createWebRtcTransport({
      enalbleUdp: true,
      enalbleTcp: true,
      preferUdp: true,
      listenInfos: [
        { protocol: 'udp', ip: '127.0.0.1' },
        { protocol: 'tcp', ip: '127.0.0.1' }
      ]
    })
    const clientTransportParams = {
      id: transport.id,
      iceParameters: transport,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
    resolve({ transport, clientTransportParams })
  })

module.exports = createWebRtcTransportBothKinds
