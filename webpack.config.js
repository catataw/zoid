/* @flow */
/* eslint import/no-nodejs-modules: off */

import { getWebpackConfig } from 'grumbler-scripts/config/webpack.config';

import globals from './globals';

export let FILE_NAME = 'zoid';
export let MODULE_NAME = 'zoid';

export let WEBPACK_CONFIG = getWebpackConfig({
    filename:   `${ FILE_NAME }.js`,
    modulename: MODULE_NAME,
    vars:       globals,
    minify:     false
});

export let WEBPACK_CONFIG_MIN = getWebpackConfig({
    filename:   `${ FILE_NAME }.min.js`,
    modulename: MODULE_NAME,
    minify:     true,
    vars:       globals
});

export let WEBPACK_CONFIG_FRAME = getWebpackConfig({
    filename:   `${ FILE_NAME }.frame.js`,
    modulename: MODULE_NAME,
    minify:     false,
    vars:       {
        ...globals,

        __POST_ROBOT__: {
            ...globals.__POST_ROBOT__,
            __IE_POPUP_SUPPORT__: false
        },

        __ZOID__: {
            ...globals.__ZOID__,
            __POPUP_SUPPORT__: false
        }
    }
});

export let WEBPACK_CONFIG_FRAME_MIN = getWebpackConfig({
    filename:   `${ FILE_NAME }.frame.min.js`,
    modulename: MODULE_NAME,
    minify:     true,
    vars:       {
        ...globals,

        __POST_ROBOT__: {
            ...globals.__POST_ROBOT__,
            __IE_POPUP_SUPPORT__: false
        },

        __ZOID__: {
            ...globals.__ZOID__,
            __POPUP_SUPPORT__: false
        }
    }
});

export let WEBPACK_CONFIG_FRAMEWORK = getWebpackConfig({
    filename:   `${ FILE_NAME }.frameworks.js`,
    modulename: MODULE_NAME,
    minify:     false,
    vars:       {
        ...globals,

        __POST_ROBOT__: {
            ...globals.__POST_ROBOT__,
            __IE_POPUP_SUPPORT__: false
        },

        __ZOID__: {
            ...globals.__ZOID__,
            __POPUP_SUPPORT__:     false,
            __FRAMEWORK_SUPPORT__: true
        }
    }
});

export let WEBPACK_CONFIG_FRAMEWORK_MIN = getWebpackConfig({
    filename:   `${ FILE_NAME }.frameworks.min.js`,
    modulename: MODULE_NAME,
    minify:     true,
    vars:       {
        ...globals,

        __POST_ROBOT__: {
            ...globals.__POST_ROBOT__,
            __IE_POPUP_SUPPORT__: false
        },

        __ZOID__: {
            ...globals.__ZOID__,
            __POPUP_SUPPORT__:     false,
            __FRAMEWORK_SUPPORT__: true
        }
    }
});

export let WEBPACK_CONFIG_TEST = getWebpackConfig({
    filename:   `${ FILE_NAME }.js`,
    modulename: MODULE_NAME,
    test:       true,
    vars:       {
        ...globals,

        __POST_ROBOT__: {
            ...globals.__POST_ROBOT__,
            __ALLOW_POSTMESSAGE_POPUP__: false
        },

        __ZOID__: {
            ...globals.__ZOID__,
            __POPUP_SUPPORT__:     true,
            __FRAMEWORK_SUPPORT__: true
        }
    }
});

export default [ WEBPACK_CONFIG, WEBPACK_CONFIG_MIN, WEBPACK_CONFIG_FRAME, WEBPACK_CONFIG_FRAME_MIN, WEBPACK_CONFIG_FRAMEWORK, WEBPACK_CONFIG_FRAMEWORK_MIN ];
