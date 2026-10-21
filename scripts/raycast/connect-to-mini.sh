#!/bin/bash
# @raycast.schemaVersion 1
# @raycast.title mini remote desktop
# @raycast.mode silent
# @raycast.packageName Remote Desktop
# @raycast.icon 🖥️
# @raycast.description Open MINI's saved connection in Windows App.
# @raycast.argument1 {"type":"text","placeholder":"Saved PC name (default: MINI)","optional":true}

exec /usr/bin/osascript -l JavaScript - "${1:-MINI}" <<'JXA'
/** Open an existing device so Windows App can use its saved credential. */
function run(args) {
  const target = args[0].toLowerCase();
  Application('Windows App').activate();
  const client = Application('System Events').processes.byName('Windows App');
  const startupDeadline = Date.now() + 10000;
  while (!client.exists() && Date.now() < startupDeadline) delay(0.1);
  if (!client.exists()) throw new Error('Windows App did not start.');

  client.frontmost = true;
  try {
    client.menuBars[0].menuBarItems.byName('Window').menus[0]
      .menuItems.byName('Connection Center').click();
  } catch (error) {
    throw new Error('Cannot open Connection Center. Allow Raycast under macOS Privacy & Security > Accessibility and Automation. This script needs the English Windows App interface. ' + error.message);
  }

  const windowDeadline = Date.now() + 10000;
  let center;
  while (Date.now() < windowDeadline) {
    center = client.windows().find(function (window) {
      return property(window, 'name') === 'Windows App';
    });
    if (center) break;
    delay(0.1);
  }
  if (!center) throw new Error('Cannot find the Windows App connection window.');

  const navigation = descendants(center).filter(function (element) {
    return property(element, 'role') === 'AXButton' &&
      property(element, 'description') === 'Devices';
  });
  if (navigation.length !== 1) throw new Error('Cannot identify the Devices button. The Windows App interface may differ.');
  navigation[0].actions.byName('AXPress').perform();

  const deviceDeadline = Date.now() + 10000;
  while (Date.now() < deviceDeadline) {
    const cards = descendants(center).filter(function (element) {
      const label = property(element, 'description');
      if (typeof label !== 'string' || label.toLowerCase() !== target) return false;
      return (property(element, 'actions') || []).some(function (action) {
        return property(action, 'name') === 'AXPress';
      });
    });
    if (cards.length > 1) throw new Error('Several saved devices have that name. Give the desired device a unique name.');
    if (cards.length === 1) {
      cards[0].actions.byName('AXPress').perform();
      return 'Requested connection to ' + args[0];
    }
    delay(0.1);
  }
  throw new Error('Saved device not found: ' + args[0] + '. Use Devices grid view, clear search and filters, and make its card visible. Pass its exact display name as the Raycast argument.');
}

/** Read an accessibility property that may be unavailable on some controls. */
function property(element, name) {
  try {
    return element[name]();
  } catch (_) {
    return null;
  }
}

/** Collect controls from this window without crossing into another window. */
function descendants(root) {
  const result = [];
  let level = [root];
  for (let depth = 0; depth < 15 && level.length; depth++) {
    result.push.apply(result, level);
    level = level.reduce(function (children, element) {
      return children.concat(property(element, 'uiElements') || []);
    }, []);
  }
  return result;
}
JXA
