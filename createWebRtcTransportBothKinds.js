const createWebRtcTransportBothKinds = router =>
  new Promise(async (resolve, reject) => {
    const transport = await router.createWebRtcTransport({
      enalbleUdp: true,
      enalbleTcp: true,
      preferUdp: true,
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedIp: '10.0.0.20' },
        { protocol: 'tcp', ip: '0.0.0.0', announcedIp: '10.0.0.20' }
      ]
    })
    const clientTransportParams = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
    resolve({ transport, clientTransportParams })
  })

module.exports = createWebRtcTransportBothKinds
