'use strict';

angular.module('mentio', [])
    .directive('mentio', function (mentioUtil, $compile, $log, $document, $timeout) {
        return {
            restrict: 'A',
            scope: {
                macros: '=mentioMacros',
                search: '&mentioSearch',
                select: '&mentioSelect',
                items: '=mentioItems',
                typedTerm: '=mentioTypedTerm',
                ngModel: '='
            },
            controller: function($scope, $timeout, $attrs) {
 
                $scope.query = function (triggerChar, triggerText) {
                    var remoteScope = $scope.triggerCharMap[triggerChar];
                    remoteScope.showMenu();

                    remoteScope.search({
                        term: triggerText
                    });

                    remoteScope.typedTerm = triggerText;
                };

                $scope.defaultSearch = function(locals) {
                    var results = [];
                    angular.forEach($scope.items, function(item) {
                        if (item.label.toUpperCase().indexOf(locals.term.toUpperCase()) >= 0) {
                            results.push(item);
                        }
                    });
                    $scope.localItems = results;
                };

                $scope.bridgeSearch = function(termString) {
                    var searchFn = $attrs.mentioSearch ? $scope.search : $scope.defaultSearch;
                    searchFn({
                        term: termString
                    });
                };

                $scope.defaultSelect = function(locals) {
                    return $scope.defaultTriggerChar + locals.item.label;
                };

                $scope.bridgeSelect = function(itemVar) {
                    var selectFn = $attrs.mentioSelect ? $scope.select : $scope.defaultSelect;
                    return selectFn({
                        item: itemVar
                    });
                };

                $scope.setTriggerText = function(text) {
                    if ($scope.syncTriggerText) {
                        $scope.typedTerm = text;
                    }
                };

                $scope.replaceText = function (triggerChar, item) {
                    var remoteScope = $scope.triggerCharMap[triggerChar];
                    var text = remoteScope.select({
                        item: item
                    });
                    mentioUtil.replaceTriggerText($scope.targetElement, $scope.targetElementPath,
                        $scope.targetElementSelectedOffset, $scope.triggerCharSet, text);
                    $scope.setTriggerText('');
                    angular.element($scope.targetElement).triggerHandler('change');
                    if ($scope.isContentEditable()) {
                        $scope.contentEditableMenuPasted = true;
                        var timer = $timeout(function() {
                            $scope.contentEditableMenuPasted = false;
                        }, 100);
                        $scope.$on('$destroy', function() {
                            $timeout.cancel(timer);
                        });
                    }
                };

                $scope.hideAll = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            $scope.triggerCharMap[key].hideMenu();
                        }
                    }
                };

                $scope.getActiveMenuScope = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                return $scope.triggerCharMap[key];
                            }
                        }
                    }
                    return null;
                };

                $scope.selectActive = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                $scope.triggerCharMap[key].selectActive();
                            }
                        }
                    }
                };

                $scope.isActive = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                return true;
                            }
                        }
                    }
                    return false;
                };

                $scope.isContentEditable = function() {
                    return ($scope.targetElement.nodeName !== 'INPUT' && $scope.targetElement.nodeName !== 'TEXTAREA');
                };

                $scope.replaceMacro = function(macro, hasTrailingSpace) {
                    if (!hasTrailingSpace) {
                        $scope.replacingMacro = true;
                        $scope.timer = $timeout(function() {
                            mentioUtil.replaceMacroText($scope.targetElement, $scope.targetElementPath,
                                $scope.targetElementSelectedOffset, $scope.macros, $scope.macros[macro]);
                            angular.element($scope.targetElement).triggerHandler('change');
                            $scope.replacingMacro = false;
                        }, 300);
                        $scope.$on('$destroy', function() {
                            $timeout.cancel($scope.timer);
                        });
                    } else {
                        mentioUtil.replaceMacroText($scope.targetElement, $scope.targetElementPath,
                            $scope.targetElementSelectedOffset, $scope.macros, $scope.macros[macro]);
                    }
                };

                $scope.addMenu = function(menuScope) {
                    if (menuScope.parentScope && $scope.triggerCharMap.hasOwnProperty(menuScope.triggerChar)) {
                        return;
                    }
                    $scope.triggerCharMap[menuScope.triggerChar] = menuScope;
                    if ($scope.triggerCharSet === undefined) {
                        $scope.triggerCharSet = [];
                    }
                    $scope.triggerCharSet.push(menuScope.triggerChar);
                    menuScope.setParent($scope);
                };

                $scope.$on(
                    'menuCreated', function (event, data) {
                        if ($attrs.id === data.targetElement) {
                            $scope.addMenu(data.scope);
                        }
                    }
                );

                $document.on(
                    'click', function () {
                        if ($scope.isActive()) {
                            $scope.$apply(function () {
                                $scope.hideAll();
                            });
                        }
                    }
                );

                $document.on(
                    'keydown keypress paste', function (event) {
                        var activeMenuScope = $scope.getActiveMenuScope();
                        if (activeMenuScope) {
                            if (event.which === 9) {
                                activeMenuScope.selectActive();
                            }

                            if (event.which === 27) {
                                event.preventDefault();
                                activeMenuScope.$apply(function () {
                                    activeMenuScope.hideMenu();
                                });
                            }

                            if (event.which === 40) {
                                event.preventDefault();
                                activeMenuScope.$apply(function () {
                                    activeMenuScope.activateNextItem();
                                });
                            }

                            if (event.which === 38) {
                                event.preventDefault();
                                activeMenuScope.$apply(function () {
                                    activeMenuScope.activatePreviousItem();
                                });
                            }

                            if (event.which === 13 || event.which === 32) {
                                event.preventDefault();
                                activeMenuScope.selectActive();
                            }
                        }
                    }
                );
            },
            link: function (scope, element, attrs) {
                scope.triggerCharMap = {};
                attrs.$set('autocomplete','off');

                if (attrs.mentioItems) {
                    scope.localItems = [];
                    scope.parentScope = scope;
                    var itemsRef = attrs.mentioSearch ? ' mentio-items="items"' : ' mentio-items="localItems"';

                    scope.defaultTriggerChar = attrs.mentioTriggerChar ? scope.$eval(attrs.mentioTriggerChar) : '@';

                    var html = '<mentio-menu' +
                        ' mentio-search="bridgeSearch(term)"' +
                        ' mentio-select="bridgeSelect(item)"' +
                        itemsRef;

                    if (attrs.mentioTemplateUrl) {
                        html = html + ' mentio-template-url="' + attrs.mentioTemplateUrl + '"';
                    }
                    html = html + ' mentio-trigger-char="\'' + scope.defaultTriggerChar + '\'"' +
                        ' mentio-parent-scope="parentScope"' +
                        '/>';
                    var linkFn = $compile(html);
                    var el = linkFn(scope);

                    element.parent().append(el);
                }

                if (attrs.mentioTypedTerm) {
                    scope.syncTriggerText = true;
                }

                scope.$watch(
                    'ngModel',
                    function () {
                        if (scope.contentEditableMenuPasted) {
                            // don't respond to changes from insertion of the menu content
                            scope.contentEditableMenuPasted = false;
                            return;
                        }

                        if (scope.replacingMacro) {
                            $timeout.cancel(scope.timer);
                            scope.replacingMacro = false;
                        }

                        var mentionInfo = mentioUtil.getTriggerInfo(scope.triggerCharSet);

                        if (mentionInfo !== undefined) {
                            /** save selection info about the target control for later re-selection */
                            scope.targetElement = mentionInfo.mentionSelectedElement;
                            scope.targetElementPath = mentionInfo.mentionSelectedPath;
                            scope.targetElementSelectedOffset = mentionInfo.mentionSelectedOffset;

                            /* publish to external */
                            scope.setTriggerText(mentionInfo.mentionText);
                            /* perform query */
                            scope.query(mentionInfo.mentionTriggerChar, mentionInfo.mentionText);
                        } else {
                            scope.setTriggerText('');
                            scope.hideAll();

                            var macroMatchInfo = mentioUtil.getMacroMatch(scope.macros);

                            if (macroMatchInfo !== undefined) {
                                scope.targetElement = macroMatchInfo.macroSelectedElement;
                                scope.targetElementPath = macroMatchInfo.macroSelectedPath;
                                scope.targetElementSelectedOffset = macroMatchInfo.macroSelectedOffset;
                                scope.replaceMacro(macroMatchInfo.macroText, macroMatchInfo.macroHasTrailingSpace);
                            }
                        }
                    }
                );
            }
        };
    })

    .directive('mentioMenu', function (mentioUtil, $rootScope, $log, $window, $document) {
        return {
            restrict: 'E',
            scope: {
                search: '&mentioSearch',
                select: '&mentioSelect',
                items: '=mentioItems',
                triggerChar: '=mentioTriggerChar',
                forElem: '=mentioFor',
                parentScope: '=mentioParentScope'
            },
            templateUrl: function(tElement, tAttrs) {
                return tAttrs.mentioTemplateUrl !== undefined ? tAttrs.mentioTemplateUrl : 'mentio-menu.tpl.html';
            },
            controller: function ($scope) {
                $scope.visible = false;

                // callable both with controller (menuItem) and without controller (local)
                this.activate = $scope.activate = function (item) {
                    $scope.activeItem = item;
                };

                // callable both with controller (menuItem) and without controller (local)
                this.isActive = $scope.isActive = function (item) {
                    return $scope.activeItem === item;
                };

                // callable both with controller (menuItem) and without controller (local)
                this.selectItem = $scope.selectItem = function (item) {
                    $scope.hideMenu();
                    $scope.parentMentio.replaceText($scope.triggerChar, item);
                };

                $scope.activateNextItem = function () {
                    var index = $scope.items.indexOf($scope.activeItem);
                    this.activate($scope.items[(index + 1) % $scope.items.length]);
                };

                $scope.activatePreviousItem = function () {
                    var index = $scope.items.indexOf($scope.activeItem);
                    this.activate($scope.items[index === 0 ? $scope.items.length - 1 : index - 1]);
                };

                $scope.selectActive = function () {
                    $scope.selectItem($scope.activeItem);
                };

                $scope.isVisible = function () {
                    return $scope.visible;
                };

                $scope.showMenu = function () {
                    if (!$scope.visible) {
                        $scope.requestVisiblePendingSearch = true;
                    }
                };

                $scope.setParent = function (scope) {
                    $scope.parentMentio = scope;
                };
            },

            link: function (scope, element) {
                element[0].parentNode.removeChild(element[0]);
                $document[0].body.appendChild(element[0]);
                scope.menuElement = element; // for testing

                if (scope.parentScope) {
                    scope.parentScope.addMenu(scope);
                } else {
                    if (!scope.forElem) {
                        $log.error('mentio-menu requires a target element in tbe mentio-for attribute');
                        return;
                    }
                    if (!scope.triggerChar) {
                        $log.error('mentio-menu requires a trigger char');
                        return;
                    }
                    var targetElement = $document[0].querySelector('#' + scope.forElem);

                    if (targetElement) {
                        var ngElem = angular.element(targetElement);
                        var mentioAttr = ngElem.attr('mentio');
                        if (mentioAttr !== undefined) {
                            // send own scope to mentio directive so that the menu
                            // becomes attached
                            $rootScope.$broadcast('menuCreated', 
                                {
                                    targetElement : scope.forElem,
                                    scope : scope
                                });
                            scope.targetElement = ngElem;
                        } else {
                            $log.error('Error, no mentio directive on target element ' + scope.forElem);
                        }
                    } else {
                        $log.error('Error, no such element: ' + scope.forElem);
                    }
                }

                angular.element($window).bind(
                    'resize', function () {
                        if (scope.isVisible()) {
                            var triggerCharSet = [];
                            triggerCharSet.push(scope.triggerChar);
                            mentioUtil.popUnderMention(triggerCharSet, element);
                        }
                    }
                );

                scope.$watch('items', function (items) {
                    if (items && items.length > 0) {
                        scope.activate(items[0]);
                        if (!scope.visible && scope.requestVisiblePendingSearch) {
                            scope.visible = true;
                            scope.requestVisiblePendingSearch = false;
                        }
                    } else {
                        scope.hideMenu();
                    }
                });

                scope.$watch('isVisible()', function (visible) {
                    // wait for the watch notification to show the menu
                    if (visible) {
                        var triggerCharSet = [];
                        triggerCharSet.push(scope.triggerChar);
                        mentioUtil.popUnderMention(triggerCharSet, element);
                    }
                });

                scope.hideMenu = function () {
                    scope.visible = false;
                    element.css('display', 'none');
                };

            }
        };
    })

    .directive('mentioMenuItem', function () {
        return {
            restrict: 'A',
            scope: {
                item: '=mentioMenuItem'
            },
            require: '^mentioMenu',
            link: function (scope, element, attrs, controller) {

                scope.$watch(function () {
                    return controller.isActive(scope.item);
                }, function (active) {
                    if (active) {
                        element.addClass('active');
                    } else {
                        element.removeClass('active');
                    }
                });

                element.bind('mouseenter', function () {
                    scope.$apply(function () {
                        controller.activate(scope.item);
                    });
                });

                element.bind('click', function (e) {
                    e.preventDefault();
                    controller.selectItem(scope.item);
                });
            }
        };
    })
    .filter('unsafe', function($sce) {
        return function (val) {
            return $sce.trustAsHtml(val);
        };
    })
    .filter('mentioHighlight', function() {
        function escapeRegexp (queryToEscape) {
            return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
        }

        return function (matchItem, query, hightlightClass) {
            if (query) {
                var replaceText = hightlightClass ?
                                 '<span class="' + hightlightClass + '">$&</span>' :
                                 '<strong>$&</strong>';
                return ('' + matchItem).replace(new RegExp(escapeRegexp(query), 'gi'), replaceText);
            } else {
                return matchItem;
            }
        };
    });
