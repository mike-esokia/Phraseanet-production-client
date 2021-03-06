require('./facets.scss');

import $ from 'jquery';
require('jquery-ui');
require('jquery.fancytree/src/jquery.fancytree');
import * as _ from 'underscore';
const workzoneFacets = (services) => {
    const { configService, localeService, appEvents } = services;
    let selectedFacetValues = [];

    /*var getSelectedFacets = function() {
     return selectedFacetValues;
     };*/

    var resetSelectedFacets = function () {
        selectedFacetValues = [];
        return selectedFacetValues;
    };
    var loadFacets = function (facets) {
        // Convert facets data to fancytree source format
        var treeSource = _.map(facets, function (facet) {
            // Values
            var values = _.map(facet.values, function (value) {
                return {
                    title: value.value + ' (' + value.count + ')',
                    query: value.query,
                    label: value.value,
                    tooltip: value.value + ' (' + value.count + ')'
                };
            });
            // Facet
            return {
                name: facet.name,
                title: facet.label,
                folder: true,
                children: values,
                expanded: _.isUndefined(selectedFacetValues[facet.name])
            };
        });

        treeSource.sort(_sortFacets('title', true, function (a) {
            return a.toUpperCase();
        }));

        treeSource = _sortByPredefinedFacets(treeSource, 'name', ['Base_Name', 'Collection_Name', 'Type_Name']);

        return _getFacetsTree().reload(treeSource);
    };

    // from stackoverflow
    // http://stackoverflow.com/questions/979256/sorting-an-array-of-javascript-objects/979325#979325
    function _sortFacets(field, reverse, primer) {
        var key = function (x) {
            return primer ? primer(x[field]) : x[field];
        };

        return function (a, b) {
            let A = key(a);
            let B = key(b);
            return ((A < B) ? -1 : ((A > B) ? 1 : 0)) * [-1, 1][+!!reverse];
        };
    }

    function _sortByPredefinedFacets(source, field, predefinedFieldOrder) {
        let filteredSource = source.slice();
        let ordered = [];

        _.each(predefinedFieldOrder, function (fieldValue, index) {
            for (let i = filteredSource.length - 1; i > -1; --i) {
                let facet = filteredSource[i];
                if (facet[field] !== undefined) {
                    if (facet[field] === fieldValue) {
                        ordered.push(facet);
                        // remove from filtered
                        filteredSource.splice(i, 1);
                    }
                }
            }
        });

        const olen = filteredSource.length;
        // fill predefined facets with non predefined facets
        for (let i = 0; i < olen; i++) {
            ordered.push(filteredSource[i]);
        }
        return ordered;
    }

    function _getFacetsTree() {
        var $facetsTree = $('#proposals');
        if (!$facetsTree.data('ui-fancytree')) {
            $facetsTree.fancytree({
                // activate and expand
                clickFolderMode: 3,
                icon: false,
                source: [],
                activate: function (event, data) {
                    var query = data.node.data.query;
                    if (query) {
                        var facet = data.node.parent;
                        selectedFacetValues[facet.title] = data.node.data;
                        _facetCombinedSearch();
                    }
                },
                renderNode: function (event, data) {
                    var facetFilter = '';
                    if (data.node.folder && !_.isUndefined(selectedFacetValues[data.node.title])) {
                        facetFilter = selectedFacetValues[data.node.title].label;

                        var s_label = document.createElement('SPAN');
                        s_label.setAttribute('class', 'facetFilter-label');
                        s_label.setAttribute('title', facetFilter);

                        var length = 15;
                        var facetFilterString = facetFilter;
                        if (facetFilterString.length > length) {
                            facetFilterString = facetFilterString.substring(0, length) + '…';
                        }
                        s_label.appendChild(document.createTextNode(facetFilterString));

                        var s_closer = document.createElement('A');
                        s_closer.setAttribute('class', 'facetFilter-closer');

                        var s_gradient = document.createElement('SPAN');
                        s_gradient.setAttribute('class', 'facetFilter-gradient');
                        s_gradient.appendChild(document.createTextNode('\u00A0'));

                        s_label.appendChild(s_gradient);

                        var s_facet = document.createElement('SPAN');
                        s_facet.setAttribute('class', 'facetFilter');
                        s_facet.appendChild(s_label);
                        s_closer = $(s_facet.appendChild(s_closer));
                        s_closer.data('facetTitle', data.node.title);

                        s_closer.click(
                            function (event) {
                                event.stopPropagation();
                                var facetTitle = $(this).data('facetTitle');
                                delete selectedFacetValues[facetTitle];
                                _facetCombinedSearch();
                                return false;
                            }
                        );

                        $('.fancytree-folder', data.node.li).append(
                            $(s_facet)
                        );
                    }
                }
            });

        }
        return $facetsTree.fancytree('getTree');
    }

    function _facetCombinedSearch() {
        var q = $('#EDIT_query').val();
        var q_facet = '';
        _.each(_.values(selectedFacetValues), function (facetValue) {
            q_facet += (q_facet ? ' AND ' : '') + '(' + facetValue.query + ')';
        });
        if (q_facet) {
            if (q) {
                q = '(' + q + ') AND ';
            }
            q += q_facet;
        }

        appEvents.emit('search.doCheckFilters');
        appEvents.emit('search.doNewSearch', q);
        // searchModule.newSearch(q);
    }

    appEvents.listenAll({
        'facets.doLoadFacets': loadFacets,
        'facets.doResetSelectedFacets': resetSelectedFacets
    });

    return {
        loadFacets,
        resetSelectedFacets
    };

};

export default workzoneFacets;
