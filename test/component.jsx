/* @flow */
/* @jsx node */

import { node, dom } from 'jsx-pragmatic/src';

import zoid, { CLASS } from '../src';

const COMPONENT_URL = '/base/test/child.htm';

function containerTemplate({ uid, tag, actions, outlet, doc }) : HTMLElement {

    let close = (event) => {
        event.preventDefault();
        event.stopPropagation();
        return actions.close('foo');
    };

    let focus = (event) => {
        event.preventDefault();
        event.stopPropagation();
        return actions.focus();
    };

    return (
        <div id={ uid }>
            <a href="#" id={ `${ tag }-test-close` } onClick={ close } />
            <a href="#" id={ `${ tag }-test-focus` } onClick={ focus } />
            <node el={ outlet } />
        </div>
    ).render(dom({ doc }));
}

export let testComponent = zoid.create({

    tag: 'test-component',

    singleton: true,

    url: COMPONENT_URL,

    contexts: {
        iframe: true,
        popup:  true
    },

    containerTemplate,

    // $FlowFixMe
    validate({ props: { invalidate } }) {
        if (invalidate === true) {
            throw new Error('Invalidated prop is defined as true');
        }
    },

    props: {
        childEntered: {
            type:     'function',
            required: false
        },

        sendUrl: {
            type:     'function',
            required: false
        },

        foo: {
            type:     'function',
            required: false
        },

        complete: {
            type:     'function',
            required: false
        },
        
        booleanProp: {
            type:     'boolean',
            required: false
        },

        functionProp: {
            type:     'function',
            required: false
        },

        objectProp: {
            type:     'object',
            required: false
        },

        stringProp: {
            type:     'string',
            required: false
        },

        numberProp: {
            type:     'number',
            required: false
        },

        run: {
            type:     'string',
            required: false
        },

        invalidate: {
            type:     'boolean',
            required: false
        },

        validateProp: {
            type:     'string',
            required: false,

            validate(validate) {
                if (validate && validate !== 'validate') {
                    throw new Error('String does not equal "validate"');
                }
            }
        }
    }
});

export let testComponent2 = zoid.create({

    tag: 'test-component2',

    containerTemplate,

    url: COMPONENT_URL,

    props: {
        foo: {
            type:     'function',
            required: false
        },

        sendUrl: {
            type:     'function',
            required: false
        },

        run: {
            type:     'string',
            required: false
        }
    }
});

export let testComponent3 = zoid.create({

    tag: 'test-component3',

    containerTemplate,

    url: COMPONENT_URL,

    props: {
        foo: {
            type:     'function',
            required: false
        },

        sendUrl: {
            type:     'function',
            required: false
        }
    },

    contexts: {
        popup:  true,
        iframe: false
    }
});

export let testComponent4 = zoid.create({

    tag: 'test-component4',

    containerTemplate,

    url: COMPONENT_URL
});


export let testComponent5 = zoid.create({

    tag: 'test-component5',

    containerTemplate,

    url: COMPONENT_URL,

    props: {
        foo: {
            type:     'function',
            required: true
        }
    },

    contexts: {
        popup:  false,
        iframe: true
    }
});


export let testComponent_parentDomains_string = zoid.create({
    tag: 'test-component-parent-domains-string',

    allowedParentDomains: 'http://www.somedomain.com',

    url: COMPONENT_URL
});

export let testComponent_parentDomains_array_of_strings = zoid.create({
    tag: 'test-component-parent-domain-array-of-strings',

    allowedParentDomains: [ 'http://www.somedomain.com', 'http://www.otherdomain.com' ],

    url: COMPONENT_URL
});


export let testComponent_parentDomains_array_of_regex = zoid.create({
    tag: 'test-component-parent-domains-array-of-regex',

    // $FlowFixMe
    allowedParentDomains: [ /^http:\/\/www.somedomain.com$/, /^http:\/\/www.otherdomain.com$/ ],

    url: COMPONENT_URL
});

export let testComponent_parentDomains_string_match = zoid.create({
    tag: 'test-component-parent-domains-string-match',

    allowedParentDomains: `${ window.location.protocol }//${ window.location.host }`,

    url: COMPONENT_URL
});

export let testComponent_parentDomains_array_of_strings_match = zoid.create({
    tag: 'test-component-parent-domains-array-of-strings-match',

    allowedParentDomains: [ 'http://www.somedomain.com', `${ window.location.protocol }//${ window.location.host }` ],

    url: COMPONENT_URL
});

export let testComponent_parentDomains_array_of_strings_match_wildcard = zoid.create({
    tag: 'test-component-parent-domains-array-of-strings-match-wildcard',

    allowedParentDomains: [ 'http://www.somedomain.com', '*' ],

    url: COMPONENT_URL
});


export let testComponent_parentDomains_string_match_wildcard = zoid.create({
    tag: 'test-component-parent-domains-string-match-wildcard',

    allowedParentDomains: '*',

    url: COMPONENT_URL
});


export let testComponent_parentDomains_array_of_regex_match = zoid.create({
    tag: 'test-component-parent-domains-array-of-regex-match',

    // $FlowFixMe
    allowedParentDomains: [ /^http:\/\/www.somedomain.com$/, new RegExp(`^${ window.location.protocol }//${ window.location.host }$`) ], // eslint-disable-line security/detect-non-literal-regexp

    url: COMPONENT_URL
});
