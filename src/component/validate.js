/* @flow */

import { isPerc, isPx, values } from 'belter/src';

import { CONTEXT, PROP_TYPES } from '../constants';

import type { ComponentOptionsType } from './index';

function validatePropDefinitions<P>(options : ComponentOptionsType<P>) {

    if (options.props && !(typeof options.props === 'object')) {
        throw new Error(`Expected options.props to be an object`);
    }

    const PROP_TYPES_LIST = values(PROP_TYPES);

    if (options.props) {
        for (let key of Object.keys(options.props)) {

            // $FlowFixMe
            let prop = options.props[key];

            if (!prop || !(typeof prop === 'object')) {
                throw new Error(`Expected options.props.${ key } to be an object`);
            }

            if (!prop.type) {
                throw new Error(`Expected prop.type`);
            }

            if (PROP_TYPES_LIST.indexOf(prop.type) === -1) {
                throw new Error(`Expected prop.type to be one of ${ PROP_TYPES_LIST.join(', ') }`);
            }

            if (prop.required && prop.def) {
                throw new Error(`Required prop can not have a default value`);
            }
        }
    }
}

export function validate<P>(options : ?ComponentOptionsType<P>) { // eslint-ignore-line

    if (!options) {
        throw new Error(`Expected options to be passed`);
    }

    if (!options.tag || !options.tag.match(/^[a-z0-9-]+$/)) {
        throw new Error(`Invalid options.tag: ${ options.tag }`);
    }

    validatePropDefinitions(options);

    if (options.dimensions) {
        if (options.dimensions && !isPx(options.dimensions.width) && !isPerc(options.dimensions.width)) {
            throw new Error(`Expected options.dimensions.width to be a px or % string value`);
        }

        if (options.dimensions && !isPx(options.dimensions.height) && !isPerc(options.dimensions.height)) {
            throw new Error(`Expected options.dimensions.height to be a px or % string value`);
        }
    }

    if (options.defaultContext) {
        if (options.defaultContext !== CONTEXT.IFRAME && options.defaultContext !== CONTEXT.POPUP) {
            throw new Error(`Unsupported context type: ${ options.defaultContext || 'unknown' }`);
        }
    }

    if (!options.url) {
        throw new Error(`Must pass url`);
    }

    if (options.prerenderTemplate && typeof options.prerenderTemplate !== 'function') {
        throw new Error(`Expected options.prerenderTemplate to be a function`);
    }

    if (options.containerTemplate && typeof options.containerTemplate !== 'function') {
        throw new Error(`Expected options.containerTemplate to be a function`);
    }
}
