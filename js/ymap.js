function createMap(arr) {

//console.log(arr);

var myMap;

// Дождёмся загрузки API и готовности DOM.
ymaps.ready(init);

function init() {
    var myMap = new ymaps.Map("wrapperMap", {
            center: [55.76, 37.64],
            zoom: 3,
            controls: []
        }, {
            searchControlProvider: 'yandex#search'
        }),

        // Создание макета балуна на основе Twitter Bootstrap.
          MyBalloonLayout = ymaps.templateLayoutFactory.createClass(
              '<div class="popover" style="width:20vw;position:absolute;">' +
                  '<a class="close" href="#">&times;</a>' +
                  '<div class="arrow" ></div>' +
                  '<div class="popover-inner">' +
                  '$[[options.contentLayout]]' +
                  '</div>' +
                  '</div>', {
                  /**
                   * Строит экземпляр макета на основе шаблона и добавляет его в родительский HTML-элемент.
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#build
                   * @function
                   * @name build
                   */
                  build: function () {
                      this.constructor.superclass.build.call(this);

                      this._$element = $('.popover', this.getParentElement());

                      this.applyElementOffset();

                      this._$element.find('.close')
                          .on('click', $.proxy(this.onCloseClick, this));
                  },

                  /**
                   * Удаляет содержимое макета из DOM.
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/layout.templateBased.Base.xml#clear
                   * @function
                   * @name clear
                   */
                  clear: function () {
                      this._$element.find('.close')
                          .off('click');

                      this.constructor.superclass.clear.call(this);
                  },

                  /**
                   * Метод будет вызван системой шаблонов АПИ при изменении размеров вложенного макета.
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                   * @function
                   * @name onSublayoutSizeChange
                   */
                  onSublayoutSizeChange: function () {
                      MyBalloonLayout.superclass.onSublayoutSizeChange.apply(this, arguments);

                      if(!this._isElement(this._$element)) {
                          return;
                      }

                      this.applyElementOffset();

                      this.events.fire('shapechange');
                  },

                  /**
                   * Сдвигаем балун, чтобы "хвостик" указывал на точку привязки.
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                   * @function
                   * @name applyElementOffset
                   */
                  applyElementOffset: function () {
                      this._$element.css({
                          left: -(this._$element[0].offsetWidth / 4),
                          top: -(this._$element[0].offsetHeight * 0.9 + this._$element.find('.arrow')[0].offsetHeight)

                      });
                  },

                  /**
                   * Закрывает балун при клике на крестик, кидая событие "userclose" на макете.
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/IBalloonLayout.xml#event-userclose
                   * @function
                   * @name onCloseClick
                   */
                  onCloseClick: function (e) {
                      e.preventDefault();

                      this.events.fire('userclose');
                  },

                  /**
                   * Используется для автопозиционирования (balloonAutoPan).
                   * @see https://api.yandex.ru/maps/doc/jsapi/2.1/ref/reference/ILayout.xml#getClientBounds
                   * @function
                   * @name getClientBounds
                   * @returns {Number[][]} Координаты левого верхнего и правого нижнего углов шаблона относительно точки привязки.
                   */
                  getShape: function () {
                      if(!this._isElement(this._$element)) {
                          return MyBalloonLayout.superclass.getShape.call(this);
                      }

                      var position = this._$element.position();

                      return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([
                          [position.left, position.top], [
                              position.left + this._$element[0].offsetWidth,
                              position.top + this._$element[0].offsetHeight + this._$element.find('.arrow')[0].offsetHeight
                          ]
                      ]));
                  },

                  /**
                   * Проверяем наличие элемента (в ИЕ и Опере его еще может не быть).
                   * @function
                   * @private
                   * @name _isElement
                   * @param {jQuery} [element] Элемент.
                   * @returns {Boolean} Флаг наличия.
                   */
                  _isElement: function (element) {
                      return element && element[0] && element.find('.arrow')[0];
                  }
              }),

              clusterer = new ymaps.Clusterer({
                  clusterIcons: [
                   {
                       href: './images/circ.png',
                       size: [40, 40],
                       offset: [-20, -20]
                   },
                   {
                       href: './images/circ.png',
                       size: [60, 60],
                       offset: [-30, -30]
                  }],
                  // Эта опция отвечает за размеры кластеров.
                  // В данном случае для кластеров, содержащих до 100 элементов,
                  // будет показываться маленькая иконка. Для остальных - большая.
                  clusterNumbers: [10],
                  //clusterIconContentLayout: null,
                  preset: 'islands#invertedVioletClusterIcons',
                  groupByCoordinates: false,
                  clusterDisableClickZoom: false,
                  clusterHideIconOnBalloonOpen: true,
                  geoObjectHideIconOnBalloonOpen: false
              }),


        // Создание макета содержимого балуна.
        // Макет создается с помощью фабрики макетов с помощью текстового шаблона.
        BalloonContentLayout = ymaps.templateLayoutFactory.createClass(
            '<div class="popover-content" style="color:#fff; background-color: #1E355D; padding: 2vh;">' +
                '<p style="color:#FF9E00;">{{properties.name}}</p><br />' +
                '<p>{{properties.fio}}</p><br />' +
                '<p>{{properties.telephone}}</p><br />' +
                '<p>{{properties.email}}</p><br />' +
            '</div>', {

        });


        geoObjects = [];


        function testAddObj(countryMarker, buttonId) {
              clusterer.removeAll();
              //myMap.geoObjects.remove(clusterer);
              geoObjects = [];
              //console.log(geoObjects);

              //Подсветим кнопку
              var countryBtns = document.getElementsByClassName('country-btn');
              for (let cb of countryBtns) {
                if (cb.id == buttonId) {
                  if (!cb.classList.contains('active-btn')) {
                    cb.classList.add('active-btn');
                  }
                } else {
                  if (cb.classList.contains('active-btn')) {
                    cb.classList.remove('active-btn');
                  }
                }
              }

              //Очистим бокове меню
              document.getElementById('cities').innerHTML = '';
              //удалим все метки
              myMap.geoObjects.removeAll();

              //Нарисуем метки
              for (let y of arr) {
                var oid = y.office;
                if (y.country == countryMarker) {
                  var myPlacemark = new ymaps.Placemark([y.coords[0], y.coords[1]], {
                        name: y.office,
                        fio: y.namedir,
                        telephone: y.tel,
                        email: y.email
                      }, {
                        balloonLayout: MyBalloonLayout,
                        balloonContentLayout: BalloonContentLayout,
                        // Запретим замену обычного балуна на балун-панель.
                        // Если не указывать эту опцию, на картах маленького размера откроется балун-панель.
                        balloonPanelMaxMapArea: 0,
                        hideIconOnBalloonOpen: false,
                        balloonOffset: [3, -40],
                      iconLayout: createChipsLayout(function (zoom) {
                          // Минимальный размер метки будет 8px, а максимальный мы ограничивать не будем.
                          // Размер метки будет расти с линейной зависимостью от уровня зума.
                          return 4 * zoom + 8;
                      })
                    });
                    geoObjects.push(myPlacemark);
                    myMap.geoObjects.add(myPlacemark);
                    var ca = y.coords[0];
                    var cb = y.coords[1];
                    //myPlacemark.events.add('click', function () {
                    //    console.log(ca);
                    //    myMap.setCenter([ca, cb], 7);
                    //});


                      //И наполним боковое меню
                        if (!document.getElementById(y.city)) {
                          var nodeBtn = document.createElement("button");
                          nodeBtn.setAttribute("type", "button");
                          nodeBtn.setAttribute("class", "collapsible city-header");
                          nodeBtn.innerHTML = y.city;
                          var nodeDiv = document.createElement("div");
                          nodeDiv.id = y.city;
                          nodeDiv.classList.add('content');
                          var nodeHr = document.createElement("hr");
                          nodeHr.setAttribute("style", "color: #EDEDED; margin-top: 2vh; margin-bottom: 3vh; border: 0.1vh solid;");
                          document.getElementById('cities').appendChild(nodeBtn);
                          document.getElementById('cities').appendChild(nodeDiv);
                          document.getElementById('cities').appendChild(nodeHr);
                        }




                }
              }

              for (let x of arr) {
                if (document.getElementById(x.city)) {
                  var nodeOffice = document.createElement('div');
                  nodeOffice.classList.add('office');
                  nodeOffice.id = x.office;
                  //toOnclick = x.coords[0] +', ' + x.coords[1];
                  //nodeOffice.setAttribute("onclick", "leftMenuOpenBaloon(" + toOnclick +")");
                  nodeOffice.innerHTML = '<p class="office-header">' + x.office + '</p><p>' + x.namedir + '</p><p>' + x.tel + '</p><p style="margin-bottom: 3vh;">' + x.email + '</p>';
                  document.getElementById(x.city).appendChild(nodeOffice);
                }
              }
              addEventsToBtns();
              leftMenuOpenBaloon();
              addEventsToMark();
              myMap.setBounds(myMap.geoObjects.getBounds(),{checkZoomRange:true, zoomMargin:3});
              clusterer.add(geoObjects);
              myMap.geoObjects.add(clusterer);

              myMap.setBounds(clusterer.getBounds(), {
              checkZoomRange: true
              });


        }

        function leftMenuOpenBaloon() {
          var elements = document.querySelectorAll(".office");
          for (var i = 0; i < elements.length; i++) {
            elements[i].onclick = function(){
              //alert(this.innerHTML);
              for (let cg of geoObjects) {
                if (this.id == cg.properties._data.name) {
                  myMap.setCenter([cg.geometry._coordinates[0], cg.geometry._coordinates[1]], 7);
                  cg.balloon.open();
                }
              }

            };
          }

        }

        function addEventsToMark() {

          for (let g of geoObjects) {
            //console.log(g.geometry._coordinates[0]);
            g.events.add('click', function () {
                myMap.setCenter([g.geometry._coordinates[0], g.geometry._coordinates[1]], 7);
            });
          }

        }

        //Покрасим карту в серый
        var ycanvas = document.getElementsByTagName('canvas');
        for (let i of ycanvas) {
          i.classList.add('to-grayscale');
        }
        var copyrights = document.getElementsByClassName('ymaps-2-1-78-copyrights-pane');
        for (let copyright of copyrights){
          copyright.setAttribute("style", "display:none;")
        }

        document.getElementById('countryBtnRus').addEventListener('click', () => { testAddObj('Rus','countryBtnRus'); });
        document.getElementById('countryBtnBel').addEventListener('click', () => { testAddObj('Bel','countryBtnBel'); });

        testAddObj('Rus','countryBtnRus');

}


}
