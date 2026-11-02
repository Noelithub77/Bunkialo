import QtQuick
import Quickshell.Io

Item {
  id: root
  property int notificationId: 0
  property var pending: null
  property int currentDuration: 0
  property bool closing: false

  function show(message, duration) {
    closeTimer.stop()
    root.pending = { message: message, duration: duration }
    root.flush()
  }

  function flush() {
    if (sender.running || root.pending === null) return
    var notice = root.pending
    root.pending = null
    root.currentDuration = notice.duration
    root.closing = false
    sender.command = ["gdbus", "call", "--session", "--timeout", "3",
      "--dest", "org.freedesktop.Notifications", "--object-path", "/org/freedesktop/Notifications",
      "--method", "org.freedesktop.Notifications.Notify", "Bunkialo", String(root.notificationId),
      "network-wireless", "WiFix", notice.message, "[]", "{'transient': <true>}", String(notice.duration)]
    sender.running = true
  }

  Process {
    id: sender
    property string output: ""
    stdout: StdioCollector { onStreamFinished: sender.output = text }
    onStarted: sender.output = ""
    onExited: function(code) {
      if (!root.closing && code === 0) {
        var match = sender.output.match(/(?:uint32\s+|\()(\d+)/)
        root.notificationId = match ? Number(match[1]) : 0
        if (root.notificationId > 0) closeTimer.restart()
      } else if (!root.closing) {
        root.notificationId = 0
        console.warn("[WiFix] notification delivery failed")
      }
      if (root.pending !== null) Qt.callLater(root.flush)
    }
  }

  Timer {
    id: closeTimer
    interval: root.currentDuration
    onTriggered: {
      if (sender.running || root.pending !== null || root.notificationId === 0) return
      root.closing = true
      sender.command = ["gdbus", "call", "--session", "--timeout", "3",
        "--dest", "org.freedesktop.Notifications", "--object-path", "/org/freedesktop/Notifications",
        "--method", "org.freedesktop.Notifications.CloseNotification", String(root.notificationId)]
      sender.running = true
    }
  }
}
