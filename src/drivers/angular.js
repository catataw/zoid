/* @flow */

import { dasherizeToCamel, replaceObject } from 'belter/src';

import type { Component, ComponentDriverType } from '../component';
import { CONTEXT } from '../constants';

type AngularModule = {
    directive : (string, () => {
        scope : { [string] : '=' | '@' },
        restrict : string,
        controller : Array<string | Function>
    }) => AngularModule
};

type Angular = {
    module : (string, Array<string>) => AngularModule
};

export let angular : ComponentDriverType<*, Angular> = {

    global() : ?Angular {
        return window.angular;
    },

    register(component : Component<*>, ng : Angular) : AngularModule {

        let module = ng.module(component.tag, []).directive(dasherizeToCamel(component.tag), () => {

            let scope = {};

            for (let key of component.getPropNames()) {
                scope[key] = '=';
            }

            scope.props = '=';

            return {
                scope,

                restrict: 'E',

                controller: [ '$scope', '$element', ($scope, $element) => {
                    component.log(`instantiate_angular_component`);

                    function safeApply() {
                        if ($scope.$root.$$phase !== '$apply' && $scope.$root.$$phase !== '$digest') {
                            try {
                                $scope.$apply();
                            } catch (err) {
                                // pass
                            }
                        }
                    }

                    let getProps = () => {

                        let scopeProps;

                        if ($scope.props) {
                            scopeProps = $scope.props;
                        } else {
                            scopeProps = {};
                            for (let key of Object.keys(scope)) {
                                if ($scope[key] !== undefined) {
                                    scopeProps[key] = $scope[key];
                                }
                            }
                        }

                        scopeProps = replaceObject(scopeProps, item => {
                            if (typeof item === 'function') {
                                return function angularWrapped() : mixed {
                                    let result = item.apply(this, arguments);
                                    safeApply();
                                    return result;
                                };
                            }
                            return item;
                        });

                        return scopeProps;
                    };

                    let renderPromise = component.render(getProps(), $element[0], CONTEXT.IFRAME);

                    $scope.$watch(() => {
                        renderPromise.then(parent => parent.updateProps(getProps()));
                    });
                } ]
            };
        });

        return module;
    }
};
