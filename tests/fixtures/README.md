Figma import fixtures
=====================

figma-basic.fig is Sigma's authored binary fixture. Regenerate with `node tools/figma/make-fixture.mjs` after `npm ci`. It contains a page, frame, text, a button, ellipse and vector.

figma-openfig.fig is the genuine Figma export `test-fixtures/OpenFigs.fig` from https://github.com/OpenFig-org/openfig-core (Git blob f69b431cc76768d255b5034468304cb9b7bc78f4). It is used to test independently exported vector geometry. openfig-core declares the MIT license; copyright rcoenen and contributors. See ../../src/vendor/figma-parser.NOTICE.txt.
