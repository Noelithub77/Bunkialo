import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "BunkialoApi.js" as Api
import "WifixApi.js" as Wifix
Panel {
  id: root
  moduleName: "noel.bunkialo"
  manageIpc: false
  property var anchorItem: null
  property var hostWidget: null
  property bool settingsOpen: false
  property bool inboxOpen: false
  property bool wifixDetailsExpanded: false
  readonly property var service: hostWidget ? hostWidget.bunkialoService : null
  readonly property var barIdentity: hostWidget || root
  readonly property color foreground: bar ? bar.barForeground : Commons.Color.foreground
  // noshell tokens (see DESIGN.md in Noel's dotfiles): Nunito text, rounded
  // symbols, soft tiles and pastel tones that follow the theme.
  readonly property string fontFamily: "Nunito"
  readonly property string iconFont: "Material Symbols Rounded"
  readonly property color paper: Commons.Color.background
  readonly property bool light: 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b > 0.5
  readonly property color tile: alpha(foreground, 0.06)
  readonly property color subtle: alpha(foreground, 0.62)
  readonly property color faint: alpha(foreground, 0.32)
  function alpha(color, amount) { return Qt.rgba(color.r, color.g, color.b, amount) }
  function tone(name) { return Api.tone(name, root.light) }
  readonly property var timetableGroups: service ? Api.groupByDay(service.snapshot.timetable) : []
  readonly property var mealDays: service ? service.messMenu : []
  readonly property var todayClasses: service
    ? (timetableGroups[service.now.getDay()] || { slots: [] }).slots : []
  readonly property var todayMeals: service
    ? Api.mealForDay(service.messMenu, service.now.getDay()).meals : []
  readonly property var snapshot: service ? service.snapshot : ({ timetable: [], notifications: [] })
  readonly property bool timetableExpanded: service ? service.timetableExpanded : false
  readonly property bool menuExpanded: service ? service.menuExpanded : false
  function open() { root.controller.show() }
  function close() {
    root.settingsOpen = false
    root.inboxOpen = false
    root.wifixDetailsExpanded = false
    if (root.service) root.service.wifixMode = false
    root.controller.hide()
  }
  function toggle() { root.opened ? root.close() : root.open() }
  function toggleInbox() {
    root.inboxOpen = !root.inboxOpen
    if (root.inboxOpen) {
      root.settingsOpen = false
      if (root.service) root.service.markInboxSeen()
    }
  }
  function movePage(list, event) {
    var delta = event.angleDelta.x !== 0 ? event.angleDelta.x : event.angleDelta.y
    if (delta === 0 || list.count < 2) return
    var direction = delta < 0 ? 1 : -1
    root.moveCarousel(list, direction)
    event.accepted = true
  }
  function moveCarousel(list, direction) {
    if (!list || list.count < 2) return
    list.currentIndex = Math.max(0, Math.min(list.count - 1, list.currentIndex + direction))
  }
  function classFocusIndex() {
    var target = root.service ? (root.service.glance.currentClass || root.service.glance.nextClass) : null
    if (!target) return 0
    for (var index = 0; index < root.todayClasses.length; index += 1) {
      if (root.todayClasses[index] === target
        || String(root.todayClasses[index].id || "") === String(target.id || "")) return index
    }
    return 0
  }
  function mealFocusIndex() {
    var target = root.service ? root.service.mealGlance.center : null
    if (!target) return 0
    for (var index = 0; index < root.todayMeals.length; index += 1) {
      if (root.todayMeals[index] === target) return index
    }
    return 0
  }
  function switchPanel(direction) { return root.bar && typeof root.bar.switchPanelFrom === "function" ? root.bar.switchPanelFrom(root.barIdentity, direction) : false }
  function openUrl(url) { var value = String(url || ""); if (value.charAt(0) === "/") value = "https://bunkialo.noelmcv7.workers.dev" + value; if (/^https?:\/\//.test(value)) Quickshell.execDetached(["xdg-open", value]) }
  onOpenedChanged: if (opened) Qt.callLater(function() {
    classCarousel.currentIndex = root.classFocusIndex()
    mealCarousel.currentIndex = root.mealFocusIndex()
  })
  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(520))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)
      PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) {
        if (dx !== 0) {
          root.moveCarousel(classCarousel, dx)
          root.moveCarousel(mealCarousel, dx)
          return
        }
        if (!root.service) return
        var expanded = root.timetableExpanded && root.menuExpanded
        if ((dy > 0 && !expanded) || (dy < 0 && expanded)) root.service.toggleExpanded()
      }
      Flickable {
        id: verticalScroll
        anchors.fill: parent
        anchors.margins: Style.space(7)
        contentWidth: width
        contentHeight: contentColumn.implicitHeight + Style.space(4)
        clip: true
        z: 1
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        Column {
          id: contentColumn
          width: verticalScroll.width
          spacing: Style.space(10)
          RowLayout {
            width: parent.width
            spacing: Style.space(7)
            Text {
              text: "Bunkialo"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.heading
              font.bold: true
            }
            Rectangle {
              width: Style.space(7)
              height: width
              radius: width / 2
              color: root.service && root.service.stale ? root.tone("coral")
                : root.service && root.service.loading ? root.tone("butter")
                : root.service && root.service.lastRefreshAt ? root.tone("green")
                : root.tone("slate")
            }
            Text {
              Layout.fillWidth: true
              text: root.service && root.service.loading ? "Updating"
                : root.service ? Api.formatUpdated(root.service.lastRefreshAt, root.service.now) : ""
              color: root.service && root.service.stale ? root.tone("coral") : root.subtle
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              font.weight: Font.DemiBold
              elide: Text.ElideRight
            }
            PanelActionButton {
              visible: !root.service || !root.service.wifixMode
              iconText: "wifi"
              tooltipText: "WiFix"
              fontFamily: root.iconFont
              foreground: root.foreground
              onClicked: {
                root.settingsOpen = false
                root.inboxOpen = false
                root.wifixDetailsExpanded = false
                if (root.service) {
                  root.service.wifixMode = true
                  root.service.detectWifix(false)
                }
              }
            }
            PanelActionButton {
              iconText: root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode) ? "arrow_back" : "settings"
              fontFamily: root.iconFont
              tooltipText: root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode) ? "Back" : "Settings"
              foreground: root.foreground
              onClicked: {
                if (root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode)) {
                  root.settingsOpen = false
                  root.inboxOpen = false
                  root.wifixDetailsExpanded = false
                  if (root.service) root.service.wifixMode = false
                } else {
                  root.settingsOpen = true
                }
              }
            }
            Item {
              implicitWidth: inboxButton.implicitWidth
              implicitHeight: inboxButton.implicitHeight
              PanelActionButton {
                id: inboxButton
                iconText: "inbox"
                tooltipText: "Inbox"
                fontFamily: root.iconFont
                foreground: root.foreground
                onClicked: {
                  root.toggleInbox()
                }
              }
              Rectangle {
                visible: !!root.service && root.service.unreadCount > 0
                anchors.right: parent.right
                anchors.top: parent.top
                width: Math.max(height, unreadText.implicitWidth + Style.space(6))
                height: Style.space(14)
                radius: height / 2
                color: root.tone("coral")
                Text {
                  id: unreadText
                  anchors.centerIn: parent
                  text: root.service && root.service.unreadCount > 9 ? "9+" : String(root.service ? root.service.unreadCount : "")
                  color: Commons.Color.background
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: true
                }
              }
            }
            PanelActionButton {
              iconText: "refresh"
              tooltipText: "Refresh"
              fontFamily: root.iconFont
              foreground: root.foreground
              enabled: !!root.service && !root.service.loading
              onClicked: if (root.service) root.service.refresh()
            }
          }
          Text {
            visible: !!root.service && root.service.errorMessage !== "" && !root.service.wifixMode
            text: root.service ? root.service.errorMessage : ""
            color: root.tone("coral")
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
            width: parent.width
          }
          Item {
            id: glancePage
            visible: !root.settingsOpen && !root.inboxOpen && (!root.service || !root.service.wifixMode)
            width: parent.width
            height: visible ? glanceColumn.implicitHeight : 0
            Column {
              id: glanceColumn
              width: parent.width
              spacing: Style.space(10)
          ListView {
            id: classCarousel
            width: parent.width
            height: Style.space(68)
            clip: true
            orientation: ListView.Horizontal
            model: root.todayClasses.length > 0 ? root.todayClasses : [null]
            property real cardWidth: Math.max(170, width * 0.56)
            currentIndex: root.classFocusIndex()
            onVisibleChanged: if (visible) currentIndex = root.classFocusIndex()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: (width - cardWidth) / 2
            preferredHighlightEnd: (width + cardWidth) / 2
            highlightMoveDuration: 200
            boundsBehavior: Flickable.StopAtBounds
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(classCarousel, event) }
            }
            spacing: Style.space(7)
            delegate: GlanceCard {
              required property int index
              required property var modelData
              width: classCarousel.cardWidth
              property var classData: modelData
              property bool isCurrent: !!classData && !!root.service && !!root.service.glance.currentClass
                && (classData === root.service.glance.currentClass
                  || String(classData.id || "") === String(root.service.glance.currentClass.id || ""))
              property bool isNext: !!classData && !!root.service && !!root.service.glance.nextClass
                && (classData === root.service.glance.nextClass
                  || String(classData.id || "") === String(root.service.glance.nextClass.id || ""))
              tag: !classData ? "Now" : isCurrent ? "Now" : isNext ? "Next" : "Class"
              value: classData ? classData.courseName : "Free"
              detail: classData ? Api.formatTime(classData.startTime) + "–" + Api.formatTime(classData.endTime) : ""
              accent: classData ? Api.courseColor(classData.courseId, root.light) : root.tone("lavender")
              foreground: root.foreground; fontFamily: root.fontFamily
            }
          }
          ListView {
            id: mealCarousel
            width: parent.width
            // Fits the centred card, so a short menu leaves no gap below.
            height: currentItem ? currentItem.implicitHeight : Style.space(90)
            Behavior on height { NumberAnimation { duration: 200; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.2, 0, 0, 1, 1, 1] } }
            clip: true
            orientation: ListView.Horizontal
            model: root.todayMeals.length > 0 ? root.todayMeals : [null]
            property real cardWidth: Math.max(240, width * 0.56)
            currentIndex: root.mealFocusIndex()
            onVisibleChanged: if (visible) currentIndex = root.mealFocusIndex()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: (width - cardWidth) / 2
            preferredHighlightEnd: (width + cardWidth) / 2
            highlightMoveDuration: 200
            boundsBehavior: Flickable.StopAtBounds
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(mealCarousel, event) }
            }
            spacing: Style.space(7)
            delegate: MealGlanceCard {
              required property int index
              required property var modelData
              width: mealCarousel.cardWidth
              property var mealData: modelData
              property bool isCenter: !!mealData && !!root.service && mealData === root.service.mealGlance.center
              property bool isNext: !!mealData && !!root.service && mealData === root.service.mealGlance.next
              tag: !mealData ? "Meal" : isCenter
                ? (root.service.mealGlance.centerIsCurrent ? "Now serving" : "Next meal")
                : isNext ? "Up next" : "Meal"
              meal: mealData
              emptyLabel: "None"
              foreground: root.foreground; fontFamily: root.fontFamily
            }
          }
          RowLayout {
            width: parent.width
            spacing: Style.space(4)
            SectionTitle { text: root.timetableExpanded && root.menuExpanded ? "Week" : "Today"; foreground: root.foreground; fontFamily: root.fontFamily }
            Item { Layout.fillWidth: true }
            PanelActionButton {
              iconText: root.timetableExpanded && root.menuExpanded ? "expand_less" : "expand_more"
              fontFamily: root.iconFont
              tooltipText: root.timetableExpanded && root.menuExpanded ? "Collapse full view" : "Expand full view"
              foreground: root.foreground
              onClicked: if (root.service) root.service.toggleExpanded()
            }
          }
          ListView {
            id: timetableScroll
            width: parent.width
            height: root.timetableExpanded
              ? Math.min(236, Math.max(116, root.timetableGroups.length > 0 ? 188 : 116)) : 0
            visible: root.timetableExpanded
            clip: true
            orientation: ListView.Horizontal
            model: root.timetableGroups
            currentIndex: root.service ? root.service.now.getDay() : new Date().getDay()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: 0
            preferredHighlightEnd: width
            highlightMoveDuration: 200
            boundsBehavior: Flickable.StopAtBounds
            interactive: count > 1
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(timetableScroll, event) }
            }
            delegate: DayPage {
              required property var modelData
              width: timetableScroll.width
              height: timetableScroll.height
              heading: modelData.shortName
              foreground: root.foreground; fontFamily: root.fontFamily
              rows: modelData.slots
              }
          }
          ListView {
            id: messScroll
            width: parent.width
            height: root.menuExpanded ? 330 : 0
            visible: root.menuExpanded
            clip: true
            orientation: ListView.Horizontal
            model: root.mealDays
            currentIndex: root.service ? root.service.now.getDay() : new Date().getDay()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: 0
            preferredHighlightEnd: width
            highlightMoveDuration: 200
            boundsBehavior: Flickable.StopAtBounds
            interactive: count > 1
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(messScroll, event) }
            }
            delegate: MealPage {
              required property var modelData
              width: messScroll.width
              height: messScroll.height
              heading: Api.dayShortName(modelData.day)
              foreground: root.foreground; fontFamily: root.fontFamily
              meals: modelData.meals
            }
          }
        }
      }
      Item {
        visible: root.inboxOpen && (!root.service || !root.service.wifixMode)
        width: parent.width
        height: visible ? inboxColumn.implicitHeight : 0
        Column {
          id: inboxColumn
          width: parent.width
          spacing: Style.space(8)
          SectionTitle { text: "Inbox"; foreground: root.foreground; fontFamily: root.fontFamily }
          Column {
            width: parent.width
            spacing: Style.space(5)
            Repeater {
              model: root.snapshot.notifications
              delegate: NotificationCard {
                required property var modelData
                notification: modelData
                onOpenRequested: function(url) { root.openUrl(url) }
              }
            }
            Column {
              visible: root.snapshot.notifications.length === 0
              width: parent.width
              topPadding: Style.space(12)
              bottomPadding: Style.space(12)
              spacing: Style.space(4)
              Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "notifications_off"
                color: root.faint
                font.family: root.iconFont
                font.pixelSize: Style.space(22)
              }
              Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "All caught up"
                color: root.faint
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                font.weight: Font.DemiBold
              }
            }
          }
        }
      }
      Item {
        visible: root.settingsOpen || (root.service && root.service.wifixMode)
        width: parent.width
        height: visible ? settingsColumn.implicitHeight : 0
        Column {
          id: settingsColumn
          width: parent.width
          spacing: Style.space(12)
          SectionTitle { visible: !root.service || !root.service.wifixMode; text: "Account"; foreground: root.foreground; fontFamily: root.fontFamily }
          Text {
            visible: (!root.service || !root.service.paired) && (!root.service || !root.service.wifixMode)
            text: "Paste the credentials JSON once"
            color: root.subtle
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
          }
          RowLayout {
            visible: (!root.service || !root.service.paired) && (!root.service || !root.service.wifixMode)
            width: parent.width
            spacing: Style.space(6)
            TextField {
              id: settingsToken
              Layout.fillWidth: true
              placeholderText: "Paste credentials JSON"
              color: root.foreground
              foreground: root.foreground
              accent: Commons.Color.accent
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              selectByMouse: true
              password: true
              height: Style.space(34)
            }
            Button {
              text: "Pair"
              radius: height / 2
              selected: true
              accent: Commons.Color.accent
              fontFamily: root.fontFamily
              onClicked: if (root.service && root.service.saveToken(settingsToken.text)) settingsToken.text = ""
            }
            PanelActionButton {
              iconText: "open_in_new"
              tooltipText: "Open Bunkialo credentials page"
              fontFamily: root.iconFont
              foreground: root.tone("lavender")
              onClicked: root.openUrl("/pair/desktop")
            }
          }
          SectionTitle {
            visible: !!root.service && root.service.wifixMode
            text: "WiFix"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }
          Column {
            visible: !!root.service && root.service.wifixMode
            width: parent.width
            spacing: Style.space(6)
            RowLayout {
              width: parent.width
              spacing: Style.space(5)
              Text {
                text: root.service && root.service.currentSsid
                  ? (Wifix.isCampusSsid(root.service.currentSsid) ? "check_circle" : "cancel") : "wifi_find"
                color: root.service && root.service.currentSsid
                  ? (Wifix.isCampusSsid(root.service.currentSsid) ? root.tone("green") : root.tone("coral"))
                  : root.faint
                font.family: root.iconFont
                font.pixelSize: Style.font.body
              }
              Text {
                Layout.fillWidth: true
                text: root.service && root.service.currentSsid
                  ? root.service.currentSsid : "Checking Wi-Fi"
                color: root.subtle
                font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall
                font.weight: Font.DemiBold
                elide: Text.ElideRight
              }
            }
            Column {
              width: parent.width
              spacing: Style.space(8)
              Button {
                visible: !!root.service && !root.service.wifixConnected
                width: parent.width
                height: Style.space(48)
                radius: height / 2
                text: root.service && root.service.wifixChecking
                  ? "Checking portal"
                  : root.service && root.service.wifixAvailable
                    ? "Connect" : "Portal unavailable"
                selected: true
                accent: Commons.Color.accent
                fontFamily: root.fontFamily
                enabled: !!root.service && root.service.wifixAvailable && !root.service.wifixChecking
                onClicked: if (root.service) root.service.startWifixConnect()
              }
              Button {
                visible: !!root.service && root.service.wifixConnected
                width: parent.width
                height: Style.space(40)
                text: "Logout"
                radius: height / 2
                bordered: true
                foreground: root.tone("coral")
                fontFamily: root.fontFamily
                enabled: !!root.service && !root.service.wifixChecking
                onClicked: if (root.service) root.service.logoutWifix()
              }
              Column {
                visible: !!root.service && root.service.wifixMessage !== ""
                  && root.service.wifixMessage !== "Internet connected · no captive portal"
                  && root.service.wifixMessage !== "Campus portal detected on this WiFi"
                width: parent.width
                spacing: Style.space(3)
                Row {
                  spacing: Style.space(2)
                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "chevron_right"
                    rotation: root.wifixDetailsExpanded ? 90 : 0
                    Behavior on rotation { NumberAnimation { duration: 200; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.2, 0, 0, 1, 1, 1] } }
                    color: root.subtle
                    font.family: root.iconFont
                    font.pixelSize: Style.font.body
                  }
                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "Details"
                    color: root.subtle
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    font.weight: Font.DemiBold
                  }
                  TapHandler { onTapped: root.wifixDetailsExpanded = !root.wifixDetailsExpanded }
                  HoverHandler { cursorShape: Qt.PointingHandCursor }
                }
                Text {
                  visible: root.wifixDetailsExpanded
                  text: root.service ? root.service.wifixMessage : ""
                  color: root.subtle
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  wrapMode: Text.Wrap
                  width: parent.width
                }
              }
            }
          }
          SectionTitle { visible: !root.service || !root.service.wifixMode; text: "Class alert"; foreground: root.foreground; fontFamily: root.fontFamily }
          RowLayout {
            visible: !root.service || !root.service.wifixMode
            width: parent.width
            spacing: Style.space(5)
            Repeater {
              model: [0, 5, 10, 15, 30]
              PillChip {
                required property int modelData
                text: modelData + " min"
                selected: !!root.service && root.service.leadMinutes === modelData
                onClicked: if (root.service) root.service.setLeadMinutes(modelData)
              }
            }
            Item { Layout.fillWidth: true }
          }
          Button {
            visible: !!root.service && root.service.paired && !root.service.wifixMode
            text: "Unpair"
            radius: height / 2
            bordered: true
            foreground: root.tone("coral")
            fontFamily: root.fontFamily
            onClicked: if (root.service) root.service.clearToken()
          }
        }
      }
    }
  }
  }
  }
  component SectionTitle: Text {
    property color foreground: Commons.Color.foreground
    property string fontFamily: Style.font.family
    color: root.subtle
    font.family: fontFamily
    font.pixelSize: Style.font.bodySmall
    font.bold: true
  }
  // A choice in a row of options: lavender tint when selected.
  component PillChip: Rectangle {
    id: pill
    property string text: ""
    property bool selected: false
    signal clicked()
    implicitWidth: pillLabel.implicitWidth + Style.space(18)
    implicitHeight: pillLabel.implicitHeight + Style.space(10)
    radius: height / 2
    color: selected ? root.alpha(root.tone("lavender"), 0.18)
      : root.alpha(root.foreground, pillHover.hovered ? 0.1 : 0.06)
    Behavior on color { ColorAnimation { duration: 160 } }
    Text {
      id: pillLabel
      anchors.centerIn: parent
      text: pill.text
      color: pill.selected ? root.tone("lavender") : root.foreground
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
    }
    HoverHandler { id: pillHover; cursorShape: Qt.PointingHandCursor }
    TapHandler { onTapped: pill.clicked() }
  }
  // A soft pill naming what a card is: tone text on an 18% tint of it.
  component TagChip: Rectangle {
    property string text: ""
    property color accent: Commons.Color.accent
    implicitWidth: tagLabel.implicitWidth + Style.space(12)
    implicitHeight: tagLabel.implicitHeight + Style.space(4)
    radius: height / 2
    color: root.alpha(accent, 0.18)
    Text {
      id: tagLabel
      anchors.centerIn: parent
      text: parent.text
      color: parent.accent
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
    }
  }
  component GlanceCard: Rectangle {
    id: glance
    property string tag: ""; property string value: ""; property string detail: ""
    property color accent: Commons.Color.accent; property color foreground: Commons.Color.foreground
    property string fontFamily: Style.font.family
    implicitHeight: 62; radius: 14
    color: root.tile
    Column {
      anchors.fill: parent; anchors.leftMargin: Style.space(10); anchors.rightMargin: Style.space(10)
      anchors.topMargin: Style.space(7); anchors.bottomMargin: Style.space(6)
      spacing: Style.space(2)
      TagChip { text: glance.tag; accent: glance.accent }
      Text {
        width: parent.width
        text: glance.value
        color: glance.foreground
        font.family: glance.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.bold: true
        elide: Text.ElideRight
      }
      Text {
        text: glance.detail
        color: root.subtle
        font.family: glance.fontFamily
        font.pixelSize: Style.font.caption
        font.weight: Font.DemiBold
      }
    }
  }
  component MealGlanceCard: Rectangle {
    id: mealCard
    property string tag: "Next meal"
    property string emptyLabel: "Done"
    property var meal: null
    readonly property string itemText: meal && meal.items ? String(meal.items.join(" · ")) : ""
    property color foreground: Commons.Color.foreground
    property string fontFamily: Style.font.family
    readonly property color accent: meal ? Api.mealColor(meal.type, root.light) : root.tone("sky")
    implicitHeight: mealColumn.implicitHeight + Style.space(16)
    radius: 14
    color: root.tile
    Column {
      id: mealColumn
      anchors.left: parent.left; anchors.right: parent.right
      anchors.top: parent.top; anchors.margins: Style.space(9)
      anchors.leftMargin: Style.space(10); anchors.rightMargin: Style.space(10)
      spacing: Style.space(3)
      RowLayout {
        width: parent.width
        spacing: Style.space(6)
        TagChip { text: mealCard.tag; accent: mealCard.accent }
        Item { Layout.fillWidth: true }
        Text {
          text: mealCard.meal ? mealCard.meal.startTime + "–" + mealCard.meal.endTime : ""
          color: root.subtle
          font.family: mealCard.fontFamily
          font.pixelSize: Style.font.caption
          font.weight: Font.DemiBold
        }
      }
      Text {
        text: mealCard.meal ? mealCard.meal.name : mealCard.emptyLabel
        color: mealCard.foreground
        font.family: mealCard.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.bold: true
      }
      Text {
        width: parent.width
        text: mealCard.itemText
        color: root.subtle
        font.family: mealCard.fontFamily
        font.pixelSize: Style.font.caption
        font.weight: Font.DemiBold
        wrapMode: Text.Wrap
        visible: text.length > 0
      }
    }
  }
  // A course or meal row: 12% tint of its tone with a tone dot.
  component ToneRow: Rectangle {
    property color accent: Commons.Color.accent
    radius: 10
    color: root.alpha(accent, 0.12)
  }
  component ToneDot: Rectangle {
    width: Style.space(7); height: width; radius: width / 2
  }
  component DayPage: Rectangle {
    id: dayPage
    property string heading: ""; property var rows: []
    property color foreground: Commons.Color.foreground; property string fontFamily: Style.font.family
    radius: 14; color: root.tile
    Column {
      anchors.fill: parent; anchors.margins: Style.space(9); spacing: Style.space(5)
      Text {
        text: dayPage.heading; color: dayPage.foreground; font.family: dayPage.fontFamily
        font.pixelSize: Style.font.body; font.bold: true
      }
      Repeater {
        model: dayPage.rows
        delegate: ToneRow {
          id: courseRow
          required property var modelData
          accent: Api.courseColor(modelData.courseId, root.light)
          width: parent.width; height: Style.space(27)
          RowLayout {
            anchors.fill: parent; anchors.leftMargin: Style.space(8); anchors.rightMargin: Style.space(8)
            spacing: Style.space(6)
            ToneDot { color: courseRow.accent }
            Text {
              text: Api.formatTime(courseRow.modelData.startTime); color: root.subtle; font.family: root.fontFamily
              font.pixelSize: Style.font.caption; font.weight: Font.DemiBold
              Layout.preferredWidth: Style.space(54)
            }
            Text {
              text: courseRow.modelData.courseName; color: root.foreground; font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true
            }
          }
        }
      }
      Text {
        visible: dayPage.rows.length === 0; text: "Free"; color: root.faint
        font.family: dayPage.fontFamily; font.pixelSize: Style.font.bodySmall; font.weight: Font.DemiBold
      }
    }
  }
  component MealPage: Rectangle {
    id: mealPage
    property string heading: ""; property var meals: []
    property color foreground: Commons.Color.foreground; property string fontFamily: Style.font.family
    radius: 14; color: root.tile
    Column {
      anchors.fill: parent; anchors.margins: Style.space(9); spacing: Style.space(5)
      Text {
        text: mealPage.heading; color: mealPage.foreground; font.family: mealPage.fontFamily
        font.pixelSize: Style.font.body; font.bold: true
      }
      Repeater {
        model: mealPage.meals
        delegate: ToneRow {
          id: mealRow
          required property var modelData
          accent: Api.mealColor(modelData.type, root.light)
          width: parent.width; height: Style.space(70)
          Column {
            anchors.fill: parent; anchors.leftMargin: Style.space(9); anchors.rightMargin: Style.space(8)
            anchors.topMargin: Style.space(5); anchors.bottomMargin: Style.space(4); spacing: Style.space(2)
            RowLayout {
              width: parent.width
              spacing: Style.space(6)
              ToneDot { color: mealRow.accent }
              Text {
                text: mealRow.modelData.name; color: root.foreground; font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true
              }
              Text {
                text: mealRow.modelData.startTime + "–" + mealRow.modelData.endTime; color: root.subtle
                font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.weight: Font.DemiBold
              }
            }
            Text {
              width: parent.width; text: mealRow.modelData.items.join(" · "); color: root.subtle
              font.family: root.fontFamily; font.pixelSize: Style.font.caption
              font.weight: Font.DemiBold; wrapMode: Text.WordWrap
            }
          }
        }
      }
      Text {
        visible: mealPage.meals.length === 0; text: "No menu"; color: root.faint
        font.family: mealPage.fontFamily; font.pixelSize: Style.font.bodySmall; font.weight: Font.DemiBold
      }
    }
  }
}
