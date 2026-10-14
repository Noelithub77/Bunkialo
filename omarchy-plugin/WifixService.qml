import QtQuick
import Quickshell
import Quickshell.Io
import "WifixApi.js" as Wifix

Item {
  id: root
  property string cacheDir: ""
  property string pairingCode: ""
  readonly property string cachePath: root.cacheDir + "/wifix-ssid-cache.json"
  readonly property string cookiePath: root.cacheDir + "/wifix.cookies"
  property string currentSsid: ""
  property string currentInterface: ""
  property string currentAddress: ""
  property var portalDnsServers: []
  property string dnsPurpose: ""
  property string dnsHost: ""
  property int portalDnsIndex: 0
  property string portalAddress: ""
  property string portalAction: ""
  property var portalCredentials: null
  property var wifixSsidCache: ({})
  property bool wifixChecking: false
  property bool wifixAvailable: false
  property bool wifixConnected: false
  property string wifixMessage: ""
  property int probeIndex: 0
  property bool probeCaptive: false
  property int verificationAttempt: 0
  property int operationGeneration: 0
  property string portalRequestKind: ""
  signal changed()

  function detect(force) {
    if (root.wifixChecking) return
    root.begin("")
  }

  function begin(action) {
    if (root.wifixChecking || deviceProc.running || ssidProc.running || metadataProc.running
        || probeProc.running || dnsProc.running || portalProc.running) return
    root.operationGeneration += 1
    root.portalAction = action
    root.portalAddress = ""
    root.portalCredentials = null
    root.verificationAttempt = 0
    root.wifixChecking = true
    root.wifixMessage = "Checking campus Wi-Fi..."
    operationTimeout.interval = action === "" ? 20000 : 90000
    operationTimeout.restart()
    root.changed()
    deviceProc.running = true
  }

  function connect() {
    if (!root.wifixChecking) root.begin("login")
  }

  function logout() {
    if (!root.wifixChecking) root.begin("logout")
  }

  function fail(message) {
    operationTimeout.stop()
    verificationDelay.stop()
    root.portalCredentials = null
    root.wifixChecking = false
    root.wifixConnected = false
    root.wifixMessage = message
    root.portalAction = ""
    root.changed()
  }

  function finish(state) {
    var expected = root.portalAction === "login" ? "online" : root.portalAction === "logout" ? "captive" : ""
    if (expected !== "" && state !== expected && root.verificationAttempt < 1) {
      root.verificationAttempt += 1
      verificationDelay.restart()
      return
    }
    operationTimeout.stop()
    root.wifixChecking = false
    root.wifixConnected = state === "online"
    root.portalCredentials = null
    if (expected !== "" && state !== expected) {
      root.wifixMessage = "WiFix " + root.portalAction + " unverified · "
        + (state === "online" ? "still online" : state === "captive" ? "login still required" : "connectivity unavailable")
    } else if (state === "online") {
      root.wifixMessage = "Campus Wi-Fi connected"
    } else if (state === "captive") {
      root.wifixMessage = "Campus Wi-Fi login required"
    } else {
      root.wifixMessage = "Wi-Fi check unavailable · retry"
    }
    if (state !== "unknown") {
      var next = Object.assign({}, root.wifixSsidCache)
      next[root.currentSsid] = { resolves: true, online: root.wifixConnected, checkedAt: Date.now() }
      root.wifixSsidCache = next
      wifixCacheFile.setText(JSON.stringify(next) + "\n")
    }
    root.portalAction = ""
    root.changed()
  }

  function checkInternet() {
    root.probeIndex = 0
    root.probeCaptive = false
    root.nextProbe()
  }

  function nextProbe() {
    if (!root.wifixChecking) return
    if (root.probeIndex >= Wifix.CONNECTIVITY_ENDPOINTS.length) {
      root.finish(root.probeCaptive ? "captive" : "unknown")
      return
    }
    root.dnsPurpose = "probe"
    root.dnsHost = Wifix.CONNECTIVITY_ENDPOINTS[root.probeIndex].url.match(/^http:\/\/([^/]+)/)[1]
    root.portalDnsIndex = 0
    root.queryNextDns()
  }

  function defer(callback) {
    var generation = root.operationGeneration
    Qt.callLater(function() {
      if (root.wifixChecking && generation === root.operationGeneration) callback()
    })
  }

  function queryNextDns() {
    if (!root.wifixChecking) return
    if (root.portalDnsIndex >= Math.min(root.portalDnsServers.length, 3)) {
      if (root.dnsPurpose === "probe") {
        root.probeIndex += 1
        root.nextProbe()
      } else root.fail("Campus portal DNS unavailable · retry")
      return
    }
    var server = root.portalDnsServers[root.portalDnsIndex++]
    dnsProc.command = ["dig", "-b", root.currentAddress, "+short", "+time=2", "+tries=1", "@" + server, root.dnsHost, "A"]
    dnsProc.output = ""
    dnsProc.running = true
  }

  function requestPortal(kind, fields) {
    if (!root.wifixChecking) return
    root.portalRequestKind = kind
    var entries = {
      url: kind === "logout" ? Wifix.LOGOUT_URL : kind === "post" ? Wifix.BASE_URL + "/" : Wifix.LOGIN_URL,
      "cookie-jar": root.cookiePath, cookie: root.cookiePath
    }
    if (kind === "post") {
      entries.request = "POST"
      entries.header = "Content-Type: application/x-www-form-urlencoded"
      entries.data = fields
    }
    portalProc.config = Wifix.portalConfig(entries, root.currentInterface, root.portalAddress)
    portalProc.output = ""
    portalProc.stdinEnabled = true
    portalProc.running = true
  }

  function readCredentials() {
    try {
      var data = JSON.parse(root.pairingCode)
      var keys = Object.keys(data)
      if (Array.isArray(data) || keys.length !== 2 || !keys[0] || typeof data[keys[0]] !== "string" || !data[keys[0]]) throw new Error("Invalid credentials")
      root.portalCredentials = { username: keys[0], password: data[keys[0]] }
      return true
    } catch (error) {
      root.fail("Save the shared credentials in Settings first")
      return false
    }
  }

  FileView {
    id: wifixCacheFile
    path: root.cachePath
    printErrors: false
    onLoaded: {
      try { root.wifixSsidCache = JSON.parse(text()) } catch (error) { root.wifixSsidCache = ({}) }
    }
  }

  Process {
    id: deviceProc
    property string output: ""
    command: ["nmcli", "--wait", "5", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device"]
    environment: ({ LC_ALL: "C" })
    stdout: StdioCollector { onStreamFinished: deviceProc.output = text }
    onStarted: deviceProc.output = ""
    onExited: function(code) {
      if (!root.wifixChecking) return
      root.currentInterface = code === 0 ? Wifix.activeInterface(deviceProc.output) : ""
      if (!root.currentInterface) { root.wifixAvailable = false; root.fail("Connect to campus Wi-Fi first"); return }
      ssidProc.command = ["nmcli", "--wait", "5", "-t", "-f", "ACTIVE,SSID", "device", "wifi", "list", "ifname", root.currentInterface, "--rescan", "no"]
      ssidProc.running = true
    }
  }

  Process {
    id: ssidProc
    property string output: ""
    environment: ({ LC_ALL: "C" })
    stdout: StdioCollector { onStreamFinished: ssidProc.output = text }
    onStarted: ssidProc.output = ""
    onExited: function(code) {
      if (!root.wifixChecking) return
      root.currentSsid = code === 0 ? Wifix.activeSsid(ssidProc.output) : ""
      root.wifixAvailable = Wifix.isCampusSsid(root.currentSsid)
      if (!root.wifixAvailable) { root.fail("Connect to IIITKottayam Wi-Fi first"); return }
      metadataProc.command = ["nmcli", "-g", "IP4.ADDRESS,IP4.DNS,DHCP4.OPTION", "device", "show", root.currentInterface]
      metadataProc.running = true
    }
  }

  Process {
    id: metadataProc
    property string output: ""
    environment: ({ LC_ALL: "C" })
    stdout: StdioCollector { onStreamFinished: metadataProc.output = text }
    onStarted: metadataProc.output = ""
    onExited: function(code) {
      if (!root.wifixChecking) return
      var metadata = Wifix.networkMetadata(metadataProc.output)
      root.currentAddress = metadata.address
      root.portalDnsServers = metadata.dns
      if (code !== 0 || !root.currentAddress || root.portalDnsServers.length === 0) { root.fail("Campus Wi-Fi address or DNS unavailable"); return }
      if (root.portalAction === "") root.checkInternet()
      else {
        root.dnsPurpose = "portal"
        root.dnsHost = Wifix.PORTAL_HOST
        root.portalDnsIndex = 0
        root.queryNextDns()
      }
    }
  }

  Process {
    id: probeProc
    property string output: ""
    property string error: ""
    stdout: StdioCollector { onStreamFinished: probeProc.output = text }
    stderr: StdioCollector { onStreamFinished: probeProc.error = Wifix.processError(text) }
    onStarted: { probeProc.output = ""; probeProc.error = "" }
    onExited: function(code) {
      if (!root.wifixChecking) return
      var state = Wifix.connectivityState(probeProc.output, code, Wifix.CONNECTIVITY_ENDPOINTS[root.probeIndex])
      console.log("[WiFix] probe=" + root.probeIndex + " state=" + state + " curl=" + code + " error=" + probeProc.error)
      if (state === "online") { root.finish("online"); return }
      if (state === "captive") root.probeCaptive = true
      root.probeIndex += 1
      root.defer(root.nextProbe)
    }
  }

  Process {
    id: dnsProc
    property string output: ""
    stdout: StdioCollector { onStreamFinished: dnsProc.output = text }
    onExited: function(code) {
      if (!root.wifixChecking) return
      root.portalAddress = code === 0 ? Wifix.resolverAddress(dnsProc.output) : ""
      if (!root.portalAddress) { root.defer(root.queryNextDns); return }
      if (root.dnsPurpose === "probe") {
        probeProc.output = ""
        probeProc.command = Wifix.connectivityCommand(root.currentInterface, Wifix.CONNECTIVITY_ENDPOINTS[root.probeIndex], root.portalAddress)
        probeProc.running = true
        return
      }
      if (root.portalAction === "login" && !root.readCredentials()) return
      root.wifixMessage = root.portalAction === "logout" ? "Logging out..." : "Opening campus portal..."
      root.changed()
      root.requestPortal(root.portalAction === "logout" ? "logout" : "get", "")
    }
  }

  Process {
    id: portalProc
    property string config: ""
    property string output: ""
    property string error: ""
    command: ["curl", "-q", "-4", "-k", "-sS", "--connect-timeout", "5", "--max-time", "20", "--max-filesize", "262144", "-i", "-w", "\nbunkialo-status:%{http_code}", "-K", "-"]
    stdout: StdioCollector { onStreamFinished: portalProc.output = text }
    stderr: StdioCollector { onStreamFinished: portalProc.error = Wifix.processError(text) }
    onStarted: {
      portalProc.error = ""
      portalProc.write(portalProc.config)
      portalProc.config = ""
      portalProc.stdinEnabled = false
    }
    onExited: function(code) {
      if (!root.wifixChecking) return
      var response = Wifix.response(portalProc.output)
      var kind = root.portalRequestKind
      console.log("[WiFix] portal action=" + kind + " http=" + response.status + " curl=" + code + " error=" + portalProc.error)
      if (code !== 0 || response.status < 200 || response.status >= 400) { root.fail("Campus portal request failed · retry"); return }
      if (kind === "get") {
        var form = Wifix.validLoginForm(response.body)
        if (!form) { root.fail("Campus portal login form unavailable"); return }
        var fields = Wifix.formData(root.portalCredentials, Wifix.hiddenField(form, "4Tredir"), Wifix.hiddenField(form, "magic"))
        root.defer(function() { root.requestPortal("post", fields) })
      } else {
        root.portalCredentials = null
        root.wifixMessage = "Verifying campus Wi-Fi " + root.portalAction + "..."
        root.changed()
        root.defer(root.checkInternet)
      }
    }
  }

  Timer { id: verificationDelay; interval: 1000; onTriggered: root.checkInternet() }
  Timer {
    id: operationTimeout
    repeat: false
    onTriggered: {
      root.fail("WiFix timed out · result unverified")
      var processes = [deviceProc, ssidProc, metadataProc, probeProc, dnsProc, portalProc]
      for (var i = 0; i < processes.length; i += 1) if (processes[i].running) processes[i].running = false
    }
  }
  Component.onCompleted: Qt.callLater(function() { wifixCacheFile.reload(); root.detect(false) })
}
