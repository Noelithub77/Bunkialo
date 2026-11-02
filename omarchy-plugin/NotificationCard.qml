import QtQuick
import qs.Commons
import qs.Commons as Commons
import "BunkialoApi.js" as Api

// One inbox entry: a soft tile, with a coral dot while unread.
Rectangle {
  id: card

  property var notification: ({})
  signal openRequested(string url)

  readonly property color ink: Commons.Color.foreground
  readonly property color paper: Commons.Color.background
  readonly property bool light: 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b > 0.5
  readonly property bool linked: !!card.notification.url

  width: parent ? parent.width : 0
  height: textColumn.implicitHeight + Style.space(16)
  radius: 14
  color: Qt.rgba(ink.r, ink.g, ink.b, hover.hovered && linked ? 0.1 : 0.06)

  Rectangle {
    visible: !!card.notification.unread
    anchors.right: parent.right
    anchors.top: parent.top
    anchors.margins: Style.space(9)
    width: Style.space(7)
    height: width
    radius: width / 2
    color: Api.tone("coral", card.light)
  }

  Column {
    id: textColumn
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    anchors.leftMargin: Style.space(10)
    anchors.rightMargin: Style.space(20)
    spacing: Style.space(2)

    Text {
      width: parent.width
      text: String(card.notification.title || "Notification")
      color: card.ink
      font.family: "Nunito"
      font.pixelSize: Style.font.bodySmall
      font.bold: true
      elide: Text.ElideRight
    }
    Text {
      width: parent.width
      visible: !!card.notification.body
      text: String(card.notification.body || "")
      color: Qt.rgba(card.ink.r, card.ink.g, card.ink.b, 0.62)
      font.family: "Nunito"
      font.pixelSize: Style.font.caption
      font.weight: Font.DemiBold
      maximumLineCount: 2
      elide: Text.ElideRight
      wrapMode: Text.WordWrap
    }
  }

  HoverHandler {
    id: hover
    cursorShape: card.linked ? Qt.PointingHandCursor : Qt.ArrowCursor
  }
  TapHandler { onTapped: card.openRequested(String(card.notification.url || "")) }
}
