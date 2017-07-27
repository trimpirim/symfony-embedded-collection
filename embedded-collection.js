/**
 * Embedded symfony collection jquery plugin
 * Usage:
 * Let's say you have a collection which needs to be embed.
 * 1. Define form rendering view. The architecture must be like this:
 *  wrapper: '.slot-media-embedded-form' -> main parent which wraps whole embedded collection and add more button
 *  children_wrapper: '.embedded-form-children-wrapper' -> all collection items must be wrapped in element which has this class
 *  children_wrapper element must have two data properties defined - data-prototype and data-prototype-name
 *  data-prototype holds whole collection item form HTML
 *  data-prototype-name holds the value which is defined in form type class
 *  child: '.embedded-form-child' -> every collection item must be wrapped in element that has this class
 *  remove_element: '.embedded-form-remove-child' -> element which indicates that this must be a button which will remove added collection item

 * form.html.twig
 * <div class="slot-steps slot-steps-step-2">
 *  <div class="form-group file-upload collection slot-media-embedded-form">
 *      {{ form_label(form.step2) }}
 *      <div class="embedded-form-children-wrapper" data-prototype="{% filter escape %}{% include 'media-prototype.html.twig' with {'form': form.step2.media.vars.prototype} %}{% endfilter %}" data-prototype-name="media_prototype">
 *          {% for media in form.step2.media %}
 *              {% include 'media-prototype.html.twig' with {'form': media} %}
 *          {% endfor %}
 *      </div>
 *      <a href="javascript:void(0);" class="embedded-form-add-child pull-right">
 *          <span class="glyphicon glyphicon-plus"></span>
 *          {{ 'media.add'|trans() }}
 *      </a>
 *  </div>
 * </div>

 * media-prototype.html.twig
 * <div class="embedded-form-child">
 *  <div class="form-group">
 *      {{ form_label(form.file) }}
 *      {{ form_widget(form.file) }}
 *      {{ form_errors(form.file) }}
 *      <a href="javascript:void(0);"  class="embedded-form-remove-child glyphicon glyphicon glyphicon-remove mr10"></a>
 *  </div>
 * </div>

 * 2. Define you form type class:
 * // SlotType.php
 * ...
 * ->add('media', CollectionType::class, [
 *  'label' => false,
 *  'entry_type' => MediaType::class,
 *  'allow_add' => true,
 *  'allow_delete' => true,
 *  'by_reference' => false,
 *  'prototype' => true,
 *  'prototype_name' => '__media_prototype__',
 * ])
 * ...

 * // MediaType.php
 * ...
 * $builder->add(
 *  'file',
 *  FileType::class,
 *  [
 *      'label' => '',
 *      'required' => false,
 *      'constraints' => [
 *          new Assert\File([
 *              'maxSize' => '2m',
 *              'mimeTypes' => ['image/png', 'image/jpeg', 'image/jpg'],
 *          ])
 *      ]
 *  ]
 * );
 * ...

 * 3. Call jquery
 * // main.js
 * ...
 * $(document).ready(_ => {
 *  $('.slot-media-embedded-form').embeddedCollection()
 * })
 * ...
 */

(function ($) {
    /**
     * EmbeddedForm class
     */
    class EmbeddedForm {
        /**
         * Constructs EmbeddedForm object
         * @param  {jQueryElement} wrapper Element which wraps whole form
         * @param  {Object} options Object of options
         */
        constructor(wrapper, options) {
            /**
             * jQuery selectors before trying to find them on DOM
             * @type {Object}
             */
            this.selectors = {
                children: '.embedded-form-children-wrapper',
                remove: '.embedded-form-remove-child',
                add: '.embedded-form-add-child',
                child: '.embedded-form-child'
            }

            this.jq = {
                wrapper: wrapper,
                children: null,
                remove: null,
                add: null,
                child: null
            }

            this.prototypeName = null
            this.proto = null

            /**
             * Parsed options
             * @type {Object}
             */
            this.options = this.parseOptions(options)

            /**
             * Method, which triggers document with event
             */
            this._onAddListener = (function (_this) {
                return function (object) {
                    const removeHidden = $(_this.jq.remove).filter((index, item) => {
                        if ($(item).css('display') === 'none') {
                            return item
                        }
                    })

                    this.childrenCount++

                    const removeElement = $(removeHidden).clone(true, true)
                    removeElement.addClass('clone')
                        .css({'display': ''})

                    const childrenWrapper = _this.jq.wrapper.find(_this.jq.children)

                    _this.removeObjectClickListener($(object))
                    childrenWrapper.append(object)

                    const addedObject = childrenWrapper.find(_this.selectors.child).last()
                    addedObject.attr('data-index', this.childrenCount)

                    _this.options.addedCallback(_this.jq.children, addedObject, _this.jq.wrapper)
                    return object
                }
            }(this))

            /**
             * Current count of children
             * @type {Number}
             */
            this.childrenCount = 0
        }

        /**
         * Finds all the required elements by selectors
         * @return {EmbeddedForm} Returns self for easier chaining
         */
        init() {
            if (!this.wrapperExist()) {
                return false
            }

            this.jq.children = $(this.selectors.children)
            this.jq.remove = $(this.selectors.remove)
            this.jq.add = $(this.selectors.add)
            this.jq.child = $(this.selectors.child)

            this.prototypeName = this.jq.wrapper.find(this.jq.children).data('prototype-name') || 'name'

            this.initAdd()
            this.initRemove()
            this.calculateChildren()
            this.addIndices()
            this.options.loadedCallback(this.childrenCount, this.getAllChildren())

            return this
        }

        /**
         * Adds index of element as data attribute
         */
        addIndices() {
            const children = this.getAllChildren()
            children.each((index, item) => {
                $(item).attr('data-index', index)
            })
        }

        /**
         * Adds add click event listener on add button
         */
        initAdd() {
            const button = this.jq.wrapper.find(this.jq.add)
            const _this = this
            button.on('click', function (e) {
                e.preventDefault()
                _this.addOne()
            })
        }

        /**
         * Adds remove element click listener on remove element
         * @param  {Object} wrapper Element which wraps the created collection item
         */
        removeObjectClickListener(wrapper) {
            const _this = this
            wrapper.on('click', this.selectors.remove, function (e) {
                _this.removeOne($(this))
                e.preventDefault()
            })
        }

        /**
         * Adds remove listeners on all already existing remove buttons
         */
        initRemove() {
            const _this = this
            this.jq.wrapper.on('click', this.selectors.remove, function (e) {
                _this.removeOne($(this))
                e.preventDefault()
            })
        }

        /**
         * Adds one collection item to collection
         */
        addOne() {
            if (!this.wrapperExist()) {
                return false
            }

            if (typeof this.options.maximumElements === 'undefined' || this.options.maximumElements > this.childrenCount) {
                const proto = this.getProto()
                const newElement = proto.replace(new RegExp('__' + this.prototypeName + '__', 'gi'), this.childrenCount)
                const element = this._onAddListener(newElement)
            }
        }

        /**
         * Adds one collection element to collection if collection is empty
         */
        addOneIfEmpty() {
            if (this.childrenCount === 0) {
                this.addOne()
                this.initRemove()
            }
        }

        /**
         * Removes one collection element from collection
         */
        removeOne(object) {
            if (!this.wrapperExist()) {
                return false
            }

            if (this.options.minimumElements < this.childrenCount) {
                const wrapper = object.closest(this.selectors.child)
                this.options.removedCallback(object, wrapper)
                object.remove()
                wrapper.remove()
                this.childrenCount--
            }
        }

        /**
         * Gets prototype HTML
         * @return {Strng} HTML of prototype which needs to be added
         */
        getProto() {
            return this.jq.wrapper.find(this.jq.children).data('prototype')
        }

        /**
         * Finds and returns all children of collection
         * @returns Array
         */
        getAllChildren() {
            const children = this.jq.wrapper.find(this.jq.child)
            return children
        }

        /**
         * Calculates children count
         */
        calculateChildren() {
            const children = this.getAllChildren()
            this.childrenCount = children.length
        }

        /**
         * Parses options
         * @param  {Object} options
         * @return {Object}
         */
        parseOptions(options) {
            options = options || {}
            options.maximumElements = options.maximumElements
            options.minimumElements = options.minimumElements || 0
            options.addedCallback = options.addedCallback || function () {
                }
            options.loadedCallback = options.loadedCallback || function () {
                }
            options.removedCallback = options.removedCallback || function () {
                }
            return options
        }

        /**
         * Checks if wrapper element exists
         * @return {Boolean}
         */
        wrapperExist() {
            return this.jq.wrapper.length > 0
        }
    }

    /**
     * Creates jquery plugin for embedded Symfony framework collections
     * Usage: $('.div').embeddedCollection()
     */
    $.fn.embeddedCollection = function (options) {
        let settings = $.extend({}, {}, options)

        return this.each(function () {
            return (new EmbeddedForm($(this), settings))
                .init()
        })
    }
})(jQuery)