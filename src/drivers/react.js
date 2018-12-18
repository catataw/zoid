/* @flow */

import { extend } from 'belter/src';

import type { Component, ComponentDriverType } from '../component';
import { CONTEXT } from '../constants';

declare class ReactClassType {

}

type ReactElementType = {

};

type ReactType = {
    createClass : ({ render : ReactElementType, componentDidMount : () => void, componentDidUpdate : () => void }) => (typeof ReactClassType),
    createElement : (string, ?{ [string] : mixed }, ...children : Array<ReactElementType>) => ReactElementType
};

type ReactDomType = {
    findDOMNode : (ReactElementType) => HTMLElement
};

type ReactLibraryType = { React : ReactType, ReactDOM : ReactDomType };

export let react : ComponentDriverType<*, ReactLibraryType> = {

    global() : ?ReactLibraryType {
        if (window.React && window.ReactDOM) {
            return {
                React:    window.React,
                ReactDOM: window.ReactDOM
            };
        }
    },

    register(component : Component<*>, { React, ReactDOM } : ReactLibraryType) : (typeof ReactClassType) {

        if (React.createClass) {

            // $FlowFixMe
            component.react = React.createClass({

                render() : ReactElementType {
                    return React.createElement('div', null);
                },

                componentDidMount() {
                    component.log(`instantiate_react_component`);

                    let el = ReactDOM.findDOMNode(this);

                    let renderPromise = component.render(extend({}, this.props), el, CONTEXT.IFRAME);

                    this.setState({ renderPromise });
                },

                componentDidUpdate() {

                    if (this.state && this.state.renderPromise) {
                        this.state.renderPromise.then(parent => parent.updateProps(extend({}, this.props)));
                    }
                }
            });
        } else {
            // $FlowFixMe
            component.react = class extends React.Component {
                render() : ReactElementType {
                    return React.createElement('div', null);
                }

                componentDidMount() {
                    component.log(`instantiate_react_component`);

                    let el = ReactDOM.findDOMNode(this);

                    let renderPromise = component.render(extend({}, this.props), el, CONTEXT.IFRAME);
                    this.setState({ renderPromise });
                }

                componentDidUpdate() {

                    if (this.state && this.state.renderPromise) {
                        this.state.renderPromise.then(parent => parent.updateProps(extend({}, this.props)));
                    }
                }
            };
        }

        return component.react;
    }
};
