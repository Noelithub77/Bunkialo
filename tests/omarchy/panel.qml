import QtQuick
import Quickshell
import Quickshell.Io
import "plugin" as Bunkialo

ShellRoot {
  QtObject {
    id: service
    property string errorMessage: "Wi-Fi check unavailable · retry"
    property string currentSsid: "IIITKottayam_5G"
    property bool wifixMode: false
    property bool wifixConnected: false
    property bool wifixChecking: false
    property bool wifixAvailable: true
    property string wifixMessage: errorMessage
    property bool stale: true
    property bool loading: false
    property bool paired: true
    property int lastRefreshAt: 0
    property int unreadCount: 0
    property int leadMinutes: 10
    property bool timetableExpanded: false
    property bool menuExpanded: false
    property var snapshot: ({ timetable: [], notifications: [] })
    property var messMenu: []
    property var now: new Date(2026, 10, 2, 12)
    property var glance: ({ currentClass: null, nextClass: null })
    property var mealGlance: ({ center: null })
    function refresh() {}
    function setLeadMinutes(value) {}
  }
  QtObject {
    id: bar
    property string position: "top"
    property int barSize: 35
    property color barForeground: "#f4c9ae"
    property var activePopout: null
    function requestPopout(owner) { activePopout = owner }
    function releasePopout(owner) { activePopout = null }
    function targetBelongsToWindow(target, window) { return true }
  }
  QtObject {
    id: host
    property var bunkialoService: service
  }
  PanelWindow {
    anchors { top: true; left: true; right: true }
    implicitHeight: 35
    color: "#181e26"
    Item { id: anchor; x: 550; width: 30; height: 35 }
  }
  Bunkialo.BunkialoPanel {
    id: panel
    bar: bar
    anchorItem: anchor
    hostWidget: host
  }
  QtObject {
    id: finder
    function find(item, name) {
      if (!item) return null
      if (item.objectName === name) return item
      var nodes = item.data || item.contentItem || item.children || []
      for (var i = 0; i < nodes.length; i += 1) {
        var match = find(nodes[i], name)
        if (match) return match
      }
      return null
    }
  }
  IpcHandler {
    target: "bunkialo-panel-test"
    function open(): void { panel.open() }
    function error(message: string): void { service.errorMessage = message }
    function close(): void { panel.close() }
    function status(): string {
      var button = finder.find(panel, "errorButton")
      var details = finder.find(panel, "errorDetails")
      return JSON.stringify({ opened: panel.opened, expanded: panel.errorsOpen,
        button: !!button && button.visible, details: !!details && details.visible,
        text: details ? details.text : "" })
    }
    function point(): string {
      var button = finder.find(panel, "errorButton")
      var point = button.mapToGlobal(button.width / 2, button.height / 2)
      return Math.round(point.x) + " " + Math.round(point.y)
    }
  }
}
