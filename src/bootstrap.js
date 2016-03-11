// import * as $ from 'jquery';
import $ from 'jquery';
const humane = require('humane-js');
require('imports?define=>false&exports=>false!./components/utils/jquery-plugins/colorAnimation');
// let dialogModule = require('../node_modules/phraseanet-common/src/components/dialog.js');
import * as AppCommons from 'phraseanet-common';

import cgu from './components/cgu';
import preferences from './components/preferences';
import publication from './components/publication';
import workzone from './components/ui/workzone';
import notify from './components/notify/index';
import Locale from './components/locale';
import ui from './components/ui';
import ConfigService from './components/core/configService';
import LocaleService from './components/locale';
import i18next from 'i18next';
import defaultConfig from './config';
import Emitter from './components/core/emitter';
import user from './components/user';
import basket from './components/basket';
import search from './components/search';
import utils from './components/utils/utils';
import dialog from './components/utils/dialog';
import Selectable from './components/utils/selectable';

class Bootstrap {

    app;
    configService;
    localeService;
    appServices;
    appUi;
    appCgu;
    appPreferences;
    appPublication;
    appWorkzone;
    appSearch;

    constructor(userConfig) {

        const configuration = Object.assign({}, defaultConfig, userConfig);

        this.appEvents = new Emitter();
        this.appEvents.listenAll(user().subscribeToEvents);
        this.appEvents.listenAll(basket().subscribeToEvents);
        // @TODO add locale/translations in streams


        this.configService = new ConfigService(configuration);
        this.localeService = new LocaleService({
            configService: this.configService
        });

        this.localeService.fetchTranslations()
            .then(() => {
                this.onConfigReady();
            });
        this.utils = utils;

        return this;
    }

    onConfigReady() {
        this.appServices = {
            configService: this.configService,
            localeService: this.localeService,
            appEvents: this.appEvents
        };

        // export translation for backward compatibility:
        window.language = this.localeService.getTranslations();

        let appProdNotification = {
            url: this.configService.get('notify.url'),
            moduleId: this.configService.get('notify.moduleId'),
            userId: this.configService.get('notify.userId')
        };

        /**
         * Initialize notifier
         * @type {{bindEvents, createNotifier, isValid, poll}}
         */
        const notifier = notify(this.appServices);
        notifier.initialize();

        // create a new notification poll:
        appProdNotification = notifier.createNotifier(appProdNotification);

        if (notifier.isValid(appProdNotification)) {
            notifier.poll(appProdNotification);
        } else {
            throw new Error('implementation error: failed to configure new notifier');
        }

        // register some global variables,
        window.bodySize = {
            x: 0,
            y: 0
        };
        window.baskAjax = null;
        window.baskAjaxrunning = false;
        window.answAjax = null;
        window.answAjaxrunning = false;
        window.searchAjax = null;
        window.searchAjaxRunning = false;

        /**
         * add components
         */
        this.appUi = ui(this.appServices);
        this.appCgu = cgu(this.appServices);
        this.appSearch = search(this.appServices);
        this.appPublication = publication(this.appServices);
        this.appPreferences = preferences(this.appServices);
        this.appWorkzone = workzone(this.appServices);

        //

        $(document).ready(() => {
            let $body = $('body');
            // trigger default route
            this.initJqueryPlugins();
            this.initDom();

            this.appWorkzone.initialize();
            // proxy selection
            this.appSearch.getResultSelectionStream().subscribe((data) => {
                console.log('subscribed to search result stream', data);
                this.appEvents.emit('broadcast.searchResultSelection', data);
            });
            // on navigation object changes
            this.appSearch.getResultNavigationStream().subscribe((data) => {
                console.log('navigation Changed', data);
                this.appEvents.emit('broadcast.searchResultNavigation', data.object);
            });


            this.appWorkzone.getResultSelectionStream().subscribe((data) => {
                console.log('subscribed to search result stream', data);
                this.appEvents.emit('broadcast.workzoneResultSelection', data);
            });


            // should be loaded after dom ready:
            this.initState();
            this.appUi.initialize();
            //this.appSearch.initialize();
            // init cgu modal:
            this.appCgu.initialize();
            // init preferences modal:
            this.appPreferences.initialize({$container: $body});
        });

    }

    initState() {
        let initialState = this.configService.get('initialState');

        switch (initialState) {
            case 'publication':
                this.appPublication.initialize();
                // window.publicationModule.fetchPublications();
                break;
            default:
                // trigger a search on loading
                this.appEvents.emit('search.doSearch');
            //$('#searchForm').trigger('submit');
            // $('form[name="phrasea_query"]').addClass('triggerAfterInit');
            // trigger last search
        }
    }

    initJqueryPlugins() {
        AppCommons.commonModule.initialize();
        $.datepicker.setDefaults({showMonthAfterYear: false});
        $.datepicker.setDefaults($.datepicker.regional[this.localeService.getLocale()]);

        console.log(AppCommons.commonModule);
        $('#help-trigger').contextMenu('#mainMenu .helpcontextmenu', {
            openEvt: 'click', dropDown: true, theme: 'vista',
            showTransition: 'slideDown',
            hideTransition: 'hide',
            shadow: false
        });
    }

    initDom() {
        document.getElementById('loader_bar').style.width = '30%';

        humane.info = humane.spawn({addnCls: 'humane-libnotify-info', timeout: 1000});
        humane.error = humane.spawn({addnCls: 'humane-libnotify-error', timeout: 1000});
        humane.forceNew = true;
        // cguModule.activateCgus();

        // catch main menu links
        $('body').on('click', 'a.dialog', (event) => {
            event.preventDefault();
            var $this = $(event.currentTarget);
            let size = 'Medium';

            if ($this.hasClass('small-dialog')) {
                size = 'Small';
            } else if ($this.hasClass('full-dialog')) {
                size = 'Full';
            }

            var options = {
                size: size,
                loading: true,
                title: $this.attr('title'),
                closeOnEscape: true
            };

            let $dialog = dialog.create(this.appServices, options);

            $.ajax({
                type: 'GET',
                url: $this.attr('href'),
                dataType: 'html',
                success: function (data) {
                    $dialog.setContent(data);
                    return;
                }
            });
        });


        $(document).bind('contextmenu', function (event) {
            let targ;
            if (event.target) {
                targ = event.target;
            } else if (event.srcElement) {
                targ = event.srcElement;
            }
            // safari bug
            if (targ.nodeType === 3) {
                targ = targ.parentNode;
            }

            var gogo = true;
            var targ_name = targ.nodeName ? targ.nodeName.toLowerCase() : false;

            if (targ_name !== 'input' && targ_name.toLowerCase() !== 'textarea') {
                gogo = false;
            }
            if (targ_name === 'input') {
                if ($(targ).is(':checkbox')) {
                    gogo = false;
                }
            }

            return gogo;
        });


        $('#loader_bar').stop().animate({
            width: '70%'
        }, 450);

        //startThesaurus();
        this.appEvents.emit('search.doCheckFilters');
        this.appUi.activeZoning();
        this.appEvents.emit('ui.resizeAll');

        $(window).bind('resize', () => {
            this.appEvents.emit('ui.resizeAll');
        });
        $('body').append('<iframe id="MODALDL" class="modalbox" src="about:blank;" name="download" style="display:none;border:none;" frameborder="0"></iframe>');

        $('body').append('<iframe id="idHFrameZ" src="about:blank" style="display:none;" name="HFrameZ"></iframe>');


        $('.datepicker').datepicker({
            changeYear: true,
            changeMonth: true,
            dateFormat: 'yy/mm/dd'
        });

        $('.tools .answer_selector').bind('click', function () {
            let el = $(this);
            let p4 = window.p4;
            if (el.hasClass('all_selector')) {
                p4.Results.Selection.selectAll();
            } else {
                if (el.hasClass('none_selector')) {
                    p4.Results.Selection.empty();
                } else {
                    if (!el.hasClass('starred_selector')) {
                        if (el.hasClass('video_selector')) {
                            p4.Results.Selection.empty();
                            p4.Results.Selection.select('.type-video');
                        } else {
                            if (el.hasClass('image_selector')) {
                                p4.Results.Selection.empty();
                                p4.Results.Selection.select('.type-image');
                            } else {
                                if (el.hasClass('document_selector')) {
                                    p4.Results.Selection.empty();
                                    p4.Results.Selection.select('.type-document');
                                } else {
                                    if (el.hasClass('audio_selector')) {
                                        p4.Results.Selection.empty();
                                        p4.Results.Selection.select('.type-audio');
                                    }
                                }
                            }
                        }
                    }
                }
            }

        }).bind('mouseover', function (event) {
            if (AppCommons.utilsModule.is_ctrl_key(event)) {
                $(this).addClass('add_selector');
            } else {
                $(this).removeClass('add_selector');
            }
        }).bind('mouseout', function () {
            $(this).removeClass('add_selector');
        });

        // getLanguage();
        this.appSearch.initialize();
        // prodModule._initAnswerForm();

        // setTimeout("pollNotifications();", 10000);


        $('#EDIT_query').bind('focus', function () {
            $(this).addClass('focused');
        }).bind('blur', function () {
            $(this).removeClass('focused');
        });


        $('input.input_select_copy').on('focus', function () {
            $(this).select();
        });
        $('input.input_select_copy').on('blur', function () {
            $(this).deselect();
        });
        $('input.input_select_copy').on('click', function () {
            $(this).select();
        });

        $('#loader_bar').stop().animate({
            width: '100%'
        }, 450, function () {
            $('#loader').parent().fadeOut('slow', function () {
                $(this).remove();
            });
        });


    }
}

const bootstrap = (userConfig) => {
    return new Bootstrap(userConfig);
};

export default bootstrap;
