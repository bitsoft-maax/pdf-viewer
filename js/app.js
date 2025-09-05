/**
 * Turn.js Catalog App
 * Based on turn.js 5th release available on turnjs.com
 *
 * All rights reserved
 */
;(function (window, $, Backbone) {
  'use strict'
  /* Singlethon abstract class */
  var url = qs('url');
  // 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf';
  var bg = qs('bg');

  var pdf = null;
  var numberOfPages = 0;

  var SingleView = Backbone.View.extend(
    {},
    // Static properties
    {
      getInstance: function (context, options) {
        context = context || this
        if (!context.instance) {
          context.instance = new this(options)
          context.instance.render()
        }
        return context.instance
      },

      remove: function (context) {
        context = context || this
        if (context.instance) {
          context.instance.remove()
          delete context.instance
        }
      }
    }
  )

  /* * Flipbook View * */

  var FlipbookView = SingleView.extend({
    el: '#flipbook',
    events: {
      missing: '_missingEvent',
      pinch: '_pinchEvent',
      zoomed: '_zoomedEvent',
      turned: '_turnedEvent',
      'vmouseover .ui-arrow-control': '_hoverArrowEvent',
      'vmouseout .ui-arrow-control': '_nohoverArrowEvent',
      'vmousedown .ui-arrow-control': '_pressArrowEvent',
      'vmouseup .ui-arrow-control': '_releaseArrowEvent',
      'vmouseover .ui-region': '_mouseoverRegion',
      'vmouseout .ui-region': '_mouseoutRegion',
      'tap .ui-region': '_tapRegion'
    },

    initialize: function () {
      this.events[Turn.isTouchDevice ? 'doubletap' : 'tap'] = '_toggleZoomEvent'
      $(window).keydown($.proxy(this, '_keydownEvent'))
      $('body').on(
        'tap',
        '.ui-arrow-next-page',
        $.proxy(this, '_tapNextArrowEvent')
      )
      $('body').on(
        'tap',
        '.ui-arrow-previous-page',
        $.proxy(this, '_tapPreviousArrowEvent')
      )

      // Tooltip for regions
      this.$el.tooltips({
        selector: '.ui-region',
        className: 'ui-tooltip ui-region-tooltip'
      })
    },

    render: function () {
      var size_w = qs('w');
      var size_h = qs('h');
        // Change these settings
        var settings = {
          options: {
            width: size_w?size_w*2:1260,
            height: size_h?size_h:891
          },
        };

      var options = $.extend(
        {
          responsive: true,
          animatedAutoCenter: true,
          smartFlip: true,
          autoScaleContent: true,
          swipe: true,
          pages: numberOfPages,
          autoCenter:true
        },
        settings.options
      )

      this.$el.turn(options)
    },

    _toggleZoomEvent: function (event) {
      this.$el.turn('toggleZoom', {
        pageX: event.pageX,
        pageY: event.pageY,
        animate: true
      })
    },

    _missingEvent: function (event, pages) {
      for (var i = 0; i < pages.length; i++) {
        this.$el.turn('addPage', this._getPageElement(pages[i]), pages[i])
      }
    },

    _pinchEvent: function (event) {
      this.$el.turn('zoom', 1, event)
    },

    _zoomedEvent: function (event, zoom) {
      if (zoom == 1) {
        $('.ui-arrow-control').show()
      } else {
        $('.ui-arrow-control').hide()
      }
    },

    _turnedEvent: function (event, page) {
      AppRouter.getInstance().navigate('page/' + page, { trigger: false })
      if (window.FlipbookSettings.loadRegions) {
        this._loadRegions(page)
      }
    },

    _hoverArrowEvent: function (event) {
      $(event.currentTarget).addClass('ui-arrow-control-hover')
    },

    _nohoverArrowEvent: function (event) {
      $(event.currentTarget).removeClass('ui-arrow-control-hover')
    },

    _pressArrowEvent: function (event) {
      $(event.currentTarget).addClass('ui-arrow-control-tap')
    },

    _releaseArrowEvent: function (event) {
      $(event.currentTarget).removeClass('ui-arrow-control-tap')
    },

    _tapNextArrowEvent: function (event) {
      this.$el.turn('next')
    },

    _tapPreviousArrowEvent: function (event) {
      this.$el.turn('previous')
    },

    _keydownEvent: function (event) {
      var nextArrow = 39
      var prevArrow = 37
      if (event.keyCode == prevArrow) {
        this.$el.turn('previous')
      } else if (event.keyCode == nextArrow) {
        this.$el.turn('next')
      }
    },

    _getPageElement: function (pageNumber) {
      var $el = $('<div />')
      var settings = window.FlipbookSettings
      var imgSrc
      var $img = $('<img />', {
        width: '100%',
        height: '100%',
        css: { display: 'none' }
      })

      pdf.getPage(pageNumber).then(function (page) {
        var scale = 1.5
        var viewport = page.getViewport({ scale })

        console.log("ViewPort:");
        console.log("ViewPort width:", viewport.width);
        console.log("ViewPort height:", viewport.height);

        var canvas = document.createElement('canvas')
        canvas.id = 'page' + pageNumber
        var context = canvas.getContext('2d')
        // canvas.height = settings.options.height
        // canvas.width = settings.options.width/2
        const outputScale = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = Math.floor(viewport.width) + 'px'
        canvas.style.height = Math.floor(viewport.height) + 'px'
        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
        var renderContext = {
          canvasContext: context,
          transform,
          viewport
        }
        var renderTask = page.render(renderContext)
        renderTask.promise.then(function () {
          imgSrc = canvas.toDataURL()
          var timerAddLoader = setTimeout(function () {
            var $loader = $('<div />', { class: 'ui-spinner' })
            $el.append($loader)
            timerAddLoader = null
          }, 150)
          // $img.css("transform", "rotate(180deg)");
          // $img.css("transform", "scale(1,-1)");

          $img.on('load', function (event) {
            $img.show()
            if (timerAddLoader === null) {
              $el.find('.ui-spinner').hide()
            } else {
              clearInterval(timerAddLoader)
            }
          })

          $img.attr('src', imgSrc)
          $el.append($img)
        })
      })
      return $el
    },

    _loadRegions: function (pageNumber) {
      var pageData = $('#flipbook').turn('pageData', pageNumber)
      if (!pageData.regions) {
        pageData.regions = new Regions([], { pageNumber: pageNumber })
        pageData.regions.fetch()
      }
    },
    _mouseoverRegion: function (event) {
      $(event.currentTarget).addClass('ui-region-hover')
    },

    _mouseoutRegion: function (event) {
      $(event.currentTarget).removeClass('ui-region-hover')
    },

    _tapRegion: function (event) {
      event.stopPropagation()

      var $el = $(event.currentTarget)
      var view = $el.data('view')

      view.processAction()
    }
  })

  var RegionModel = Backbone.Model.extend({
    idAttribute: 'id',
    className: 'none'
  })

  var RegionView = Backbone.View.extend({
    tagName: 'div',
    className: 'ui-region',
    initialize: function (options) {
      this.render()
    },
    render: function () {
      var attr = this.model.attributes

      if (attr.points) {
        var $pageElement = $('#flipbook').turn(
          'pageElement',
          this.model.pageNumber
        )

        this.$el.css({
          left: attr.points[0] * 100 + '%',
          top: attr.points[1] * 100 + '%',
          width: attr.points[2] * 100 + '%',
          height: attr.points[3] * 100 + '%'
        })

        this.$el.attr('title', attr.hint)
        this.$el.addClass('ui-region-' + attr.className)
        this.$el.data({ view: this })
        $pageElement.append(this.$el)
      }
    },

    processAction: function () {
      var attr = this.model.attributes
      var data = attr.data
      console.log(attr)
      switch (attr.className) {
        case 'page':
          $('#flipbook').turn('page', data.page)
          break
        case 'zoom':
          // var regionOffset = region.offset(),
          //   viewportOffset = $('viewer').offset(),
          //   pos = {
          //     x: regionOffset.left-viewportOffset.left,
          //     y: regionOffset.top-viewportOffset.top
          //   };
          //
          // $('viewer').zoom('zoomIn', pos);

          break
        case 'link':
          window.open(data.url)
          break
      }

      $('#flipbook').tooltips('hide')
    }
  })

  var Regions = Backbone.Collection.extend({
    model: RegionModel,
    initialize: function (models, options) {
      this.pageNumber = options.pageNumber
      this.on('add', this._add, this)
    },
    url: function () {
      return 'region/region.json'
    },

    _add: function (regionModel) {
      // Add the view
      regionModel.pageNumber = this.pageNumber
      new RegionView({ model: regionModel })
    }
  })

  /* * Page Slider View * */
  var PageSliderView = SingleView.extend({
    el: '#page-slider',

    events: {
      changeValue: '_changeValueEvent',
      slide: '_slideEvent',
      vmousedown: '_pressEvent',
      vmouseover: '_hoverEvent'
    },

    initialize: function () {
      var $el = this.$el

      $('#flipbook').on('turned', function (event, page) {
        if (!$el.slider('isUserInteracting')) {
          $el.slider('value', page)
        }
      })
    },

    render: function () {
      this.$el.slider({
        min: 1,
        max: $('#flipbook').turn('pages'),
        value: $('#flipbook').turn('page')
      })
    },

    _changeValueEvent: function (event, newPage) {
      var currentVal = this.$el.slider('value')
      if ($.inArray(currentVal, $('#flipbook').turn('view', newPage)) != -1) {
        event.preventDefault()
        return
      }
      if ($('#flipbook').turn('page', newPage) === false) {
        event.preventDefault()
      }
    },

    _slideEvent: function (event, newPage) {
      $('#miniatures').miniatures('page', newPage)
    },

    _pressEvent: function (event) {
      $('#miniatures').miniatures('listenToFlipbook', false)

      $(document).one('vmouseup', $.proxy(this, '_releasedEvent'))
    },

    _releasedEvent: function (event) {
      if (!$('#miniatures').hasClass('ui-miniatures-slider-open')) {
      }
    },

    _hoverEvent: function (event) {
      event.stopPropagation()
    }
  })

  /* * * * */
  var ControlsView = SingleView.extend({
    el: '#controls',
    _fadeTimer: null,
    _hasFadeListener: true,
    events: {
      'vmouseover #ui-icon-expand-options': '_vmouseoverIconExpand',
      'vmouseover #ui-icon-toggle': '_vmouseoverIconExpand',
      'vmouseover #options': '_vmouseoverOptions',
      'vmouseout #options': '_vmouseoutOptions',
      'tap #ui-icon-expand-options': '_tapIconExpand'
    },

    initialize: function () {
      var eventNameToFade = Turn.isTouchDevice ? 'vmousedown' : 'vmousemove'
      $(document).on(eventNameToFade, $.proxy(this, '_fade'))

      this.events[eventNameToFade + ' .all'] = '_preventFade'
      $('#miniatures').on(eventNameToFade, $.proxy(this, '_preventFade'))
      $('#zoom-slider-view').on(eventNameToFade, $.proxy(this, '_preventFade'))
    },

    _fade: function (event) {
      if (!event.donotFade) {
        var that = this

        if (event.pageY > $('#viewer').height() - 20) {
          if (this.$el.hasClass('hidden-controls')) {
            this.$el.removeClass('hidden-controls')
          }
        }

        if (this._fadeTimer) {
          clearInterval(this._fadeTimer)
        }

        this._fadeTimer = setTimeout(function () {}, 1000)
      }
    },

    stopFade: function () {
      if (this._fadeTimer) {
        clearInterval(this._fadeTimer)
        this._fadeTimer = null
      }
    },

    _preventFade: function (event) {
      this.stopFade()
      event.donotFade = true
    },

    _vmouseoverIconExpand: function (event) {
      if (!Turn.isTouchDevice) {
        this.showOptions()
      }
    },

    _vmouseoverOptions: function () {
      this.hideOptions(false)
    },
    _vmouseoutOptions: function () {
      this.hideOptions(true)
    },

    _tapIconExpand: function () {
      this.showOptions()
    },

    showOptions: function () {
      this.$el.removeClass('hidden-controls')
      this.$el.addClass('extend-ui-options')
      this.hideOptions(false)
    },

    hideOptions: function (confirmation) {
      var that = this
      if (confirmation) {
        if (!this._hideOptionTimer) {
          this._hideOptionTimer = setTimeout(function () {
            that._hideOptionTimer = null
            that.$el.removeClass('extend-ui-options')
          }, 100)
        }
      } else {
        if (this._hideOptionTimer) {
          clearInterval(this._hideOptionTimer)
          this._hideOptionTimer = null
        }
      }
    }
  })

  /* * Options View * */
  var OptionsView = SingleView.extend({
    el: '#options',

    events: {
      willShowHint: '_willShowHint',
      'vmouseover #ui-icon-zoom': '_vmouseoverIconZoom',
      'vmouseout #ui-icon-zoom': '_vmouseoutIconZoom',
      vmousedown: '_vmousedown',
      'tap .ui-icon': '_tapIcon'
    },

    initialize: function () {
      var $el = this.$el
    },

    render: function () {
      this.$el.tooltips({
        positions: 'top,left'
      })
    },

    _willShowHint: function (event, $target) {
      this.$el.tooltips('options', { positions: 'top,left' })
    },

    _vmouseoverIconZoom: function (event) {
      var $sliderView = $('#zoom-slider-view')
      var $zoomIcon = $(event.currentTarget)
      var thisOffset = Turn.offsetWhile($zoomIcon[0], function (el) {
        return el.className != 'catalog-app'
      })

      $sliderView.css({
        left: thisOffset.left,
        top: 'auto',
        bottom: 5,
        right: 'auto'
      })

      $('#zoom-slider').slider('style', 'vertical')
      ZoomSliderView.getInstance().show()
    },

    // _vmouseoutIconZoom: function (event) {
    //   ZoomSliderView.getInstance().hide(true)
    // },

    _vmousedown: function (event) {
      event.stopPropagation()
    },

    _tapIcon: function (event) {
      var $icon = $(event.currentTarget)
      switch ($icon.attr('id')) {
        case 'ui-icon-zoom':
          // Will show the zoom slider
          break
        case 'ui-icon-share':
          ShareBox.getInstance().show()
          break
        case 'ui-icon-full-screen':
          Turn.toggleFullScreen()
          break

        case 'ui-icon-toggle':
          $('#controls').toggleClass('extend-ui-options')
          break
      }
    }
  })

  /* * Zoom Slider View * */
  var ZoomSliderView = SingleView.extend({
    el: '#zoom-slider-view',

    events: {
      'changeValue #zoom-slider': '_changeValueEvent',
      'slide #zoom-slider': '_slideEvent',
      'vmousedown #zoom-slider': '_vmousedown',
      vmouseover: '_vmouseover',
      vmouseout: '_vmouseout'
    },

    render: function () {
      this.$el.find('#zoom-slider').slider({
        style: 'vertical',
        min: 1,
        max: 10
      })

      $('.catalog-app').zoom({
        flipbook: $('#flipbook'),

        max: function () {
          return largeMagazineWidth() / $('#flipbook').width()
        },

        when: {
          swipeLeft: function () {
            $(this).zoom('flipbook').turn('next')
          },
          swipeRight: function () {
            $(this).zoom('flipbook').turn('previous')
          },

          resize: function (event, scale, page, pageElement) {
            //renderPage(page)
            // if (scale==1)
            //     loadSmallPage(page, pageElement);
            // else
            //     loadLargePage(page, pageElement);
          },

          zoomIn: function () {
            mainScale = 1.8
            $('#flipbook').removeClass('animated').addClass('zoom-in')


            if (!window.escTip && !$.isTouch) {
              escTip = true

              $('<div />', { class: 'exit-message' })
                .html('<div>Press ESC to exit</div>')
                .appendTo($('body'))
                .delay(2000)
                .animate({ opacity: 0 }, 500, function () {
                  $(this).remove()
                })
            }
          },

          zoomOut: function () {
            $('.exit-message').hide()

            setTimeout(function () {
              $('#flipbook').addClass('animated').removeClass('zoom-in')
              //resizeViewport()
            }, 0)
          }
        }
      })


    },

    // _changeValueEvent: function (event, val) {
    //   var zoom = (val / 10) * ($('#flipbook').turn('maxZoom') - 1) + 1
    //   console.log("max zoom:",$('#flipbook').turn('maxZoom'))
    //   console.log(zoom)
    //   $('#flipbook').turn('zoom', val, {animate: false})
    // },

    _slideEvent: function (event, val) {
      var settings = window.FlipbookSettings
      var zoom = (val / 10) * ($('#flipbook').turn('maxZoom') - 1) + 1
      $('#flipbook').turn('zoom', zoom, {animate: false})
     // $('#flipbook').turn('size', settings.options.width*val/2, settings.options.height*val/2);
    },

    _vmousedown: function (event) {
      event.stopPropagation()
    },

    // _vmouseover: function (event) {
    //   this.show()
    //   ControlsView.getInstance().hideOptions(false)
    // },
    //
    // _vmouseout: function (event) {
    //   var that = this
    //   this.hide(true)
    // },

    show: function () {
      var $sliderEl = this.$el.find('#zoom-slider')

      $sliderEl.slider('disable', false)

      $('#zoom-slider-view').addClass('show-zoom-slider')
      $('#ui-icon-zoom').addClass('ui-icon-contrast')

      // Recalculate the slider's value
      $sliderEl.slider(
        'value',
        Math.round(
          (($('#flipbook').turn('zoom') - 1) /
            ($('#flipbook').turn('maxZoom') - 1)) *
            10
        ),
        true
      )

      $('body').one('vmousedown', $.proxy(this, 'hide'))

      this.hide(false)
    },

    hide: function (confirmation) {
      var that = this
      if (confirmation) {
        if (!this._hideTimer) {
          this._hideTimer = setTimeout(function () {
            var $sliderEl = that.$el.find('#zoom-slider')

            $sliderEl.slider('disable', true)
            $('#zoom-slider-view').removeClass('show-zoom-slider')
            $('#ui-icon-zoom').removeClass('ui-icon-contrast')
            setTimeout(function () {
              if (!$('#zoom-slider-view').hasClass('show-zoom-slider')) {
                $('#zoom-slider-view').css({ top: '', left: '' })
              }
            }, 300)
            $('body').off('vmousedown', that.hide)
            that._hideTimer = null
          }, 100)
        }
      } else {
        if (this._hideTimer) {
          clearInterval(this._hideTimer)
          this._hideTimer = null
        }
      }
    }
  })

  /* * Share Box View * */
  var ShareBox = SingleView.extend({
    className: 'ui-share-box',
    tagName: 'div',
    events: {
      tap: '_tapEvent',
      'tap .ui-icon': '_tapIconEvent'
    },

    initialize: function () {
      var html = ''

      html += '<i class="close-mark"></i>'
      html += '<div class="ui-share-options">'
      html +=
        '<a title="Татаж авах"  class="ui-icon show-hint" style="width: auto!important; color:white; border:1px dashed white; padding:5px"><i class="fa fa-cloud-download"></i> Татаж авах</a>'
      html += '</div>'

      this.$el.html(html)
      this.$el.appendTo($('body'))
    },

    render: function () {
      this.$el.tooltips({ positions: 'top' })
    },

    _tapEvent: function (event) {
      this.hide()
    },

    _tapIconEvent: function (event) {
      var $target = $(event.currentTarget)
      var currentUrl = encodeURIComponent(window.location.href)
      var title = $target.attr('title') || $target.attr('v-title')
      var text = encodeURIComponent(window.FlipbookSettings.shareMessage)
      var winOptions =
        'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'

      switch (title) {
        case 'Татаж авах':
          window.location.href = url
          break
      }

      event.stopPropagation()
    },

    show: function () {
      var that = this
      setTimeout(function () {
        that.$el.addClass('show-ui-share-box')
      }, 1)
    },

    hide: function () {
      this.$el.removeClass('show-ui-share-box')
    }
  })

  var AppRouter = Backbone.Router.extend(
    {
      routes: {
        'page/:page': '_page'
      },
      _page: function (page) {
        if (FlipbookView.instance) {
          $('#flipbook').turn('page', page)
        } else {
          window.FlipbookSettings.options.page = parseInt(page, 10)
        }
      }
    },
    {
      getInstance: function (context) {
        context = context || this
        if (!context.instance) {
          context.instance = new this()
        }
        return context.instance
      }
    }
  )

  function qs(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, '\\$&') // escape RegEx meta chars
    var match = window.location.search.match(
      new RegExp('[?&]' + key + '=([^&]+)(&|$)')
    )
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '))
  }

  function regionClick(event) {

    var region = $(event.target);

    if (region.hasClass('region')) {

      $('.magazine-viewport').data().regionClicked = true;

      setTimeout(function() {
        $('.magazine-viewport').data().regionClicked = false;
      }, 100);

      var regionType = $.trim(region.attr('class').replace('region', ''));

      return processRegion(region, regionType);

    }

  }
  function largeMagazineWidth() {
    return 2214;
  }
  function zoomTo(event) {

    setTimeout(function() {
      if ($('.catalog-app').data().regionClicked) {
        $('.catalog-app').data().regionClicked = false;
      } else {
        if ($('.catalog-app').zoom('value')==1) {
          $('.catalog-app').zoom('zoomIn', event);
        } else {
          $('.catalog-app').zoom('zoomOut');
        }
      }
    }, 1);

  }
  /* *  * */
  function bootstrap() {
    document.body.style.backgroundImage = "url('" + bg + "')"
    var pdfjsLib = window['pdfjs-dist/build/pdf']
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.js'

    var loadingTask = pdfjsLib.getDocument(url)

    loadingTask.promise.then(function (pdfDoc) {
      numberOfPages = pdfDoc.numPages
      console.log(numberOfPages)
      pdf = pdfDoc
      // Initialize routes
      AppRouter.getInstance()
      Backbone.history.start()

      // Initialize views
      FlipbookView.getInstance()
      PageSliderView.getInstance()
      OptionsView.getInstance()
      ZoomSliderView.getInstance()
      ControlsView.getInstance()

      $(window).on('orientationchange', function (event) {
        $(window).scrollTop(0)
        $(window).scrollLeft(0)
      })

      $(document).on('vmousemove', function (event) {
        event.preventDefault()
      })

      $(window).load(function () {
        $(window).scrollTop(0)
      })

      // if ($.isTouch) $('.catalog-app').bind('doubleTap', zoomTo)
      // else $('.catalog-app').bind('tap', zoomTo)
    })
  }

  $(document).ready(bootstrap)

})(window, jQuery, Backbone)
