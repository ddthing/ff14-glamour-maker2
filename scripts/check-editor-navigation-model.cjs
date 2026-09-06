const assert = require('node:assert/strict');
const EditorNavigation = require('../models/editor-navigation.js');

const navigation = EditorNavigation.create({ panels: ['stylePanel', 'itemsPanel'], defaultPanel: 'stylePanel' });
assert.equal(navigation.panel('itemsPanel'), 'itemsPanel');
assert.equal(navigation.panel('missing'), 'stylePanel');
const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'];
assert.deepEqual(keys.map(key => navigation.nextIndex(1, key, 4)), [0, 0, 2, 2, 0, 3]);
assert.equal(navigation.nextIndex(0, 'PageDown', 4), -1);
assert.equal(navigation.nextIndex(0, 'ArrowRight', 0), -1);
assert.equal(navigation.nextIndex(100, 'ArrowRight', 3), 0);
assert.equal(navigation.nextIndex(-5, 'ArrowLeft', 3), 2);
assert.equal(navigation.escapeAction({ dialogOpen: true, resetOpen: true, mobileSearchOpen: true }), 'ignore');
assert.equal(navigation.escapeAction({ resetOpen: true, mobileSearchOpen: true }), 'close-reset');
assert.equal(navigation.escapeAction({ mobileSearchOpen: true }), 'close-search');
assert.equal(navigation.escapeAction(), 'none');
assert.deepEqual(EditorNavigation.movementKeys.sort(), keys.sort());
console.log('PASS: shared panel validation, roving focus order, boundary normalization and Escape priority.');
