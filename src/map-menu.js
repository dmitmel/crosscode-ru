ig.module('crosscode-ru.fixes.map-menu.teleport-to-prepositions')
  .requires(
    'game.feature.menu.gui.map.map-area',
    'localize-me.final-locale.ready',
  )
  .defines(() => {
    if (ig.currentLang !== 'ru_RU') return;

    // see Wikipedia if you have no idea about what linguistics are going on
    // https://en.wikipedia.org/wiki/Grammatical_case
    // https://en.wikipedia.org/wiki/Inflection

    const CORRECT_MAP_NAMES_WITH_PREPOSITIONS = {
      'arid.town-2': 'в Западный город',
      'autumn.path4': 'к Озеру у обелиска',
      'autumn.path-8': 'на Последний путь',
      'autumn.entrance': 'к Входу',
      'autumn.lake-observatory': 'к Старой обсерватории',
      'autumn.guild.entrance': 'в Резиденции осени',
      'autumn-fall.path-01': 'к Южному выходу',
      'autumn-fall.path-05': 'к Северному выходу',
      'autumn-fall.path-07': 'в Руины деревни',
      'autumn-fall.raid.raid-01': 'на Райский остров 1',
      'autumn-fall.path-03': 'к Восточному выходу',
      'bergen.bergen': 'на Юг Бергена',
      'bergen.bergen2': 'на Север Бергена',
      'bergen-trail.path-1-entrance': 'к Входу',
      'bergen-trail.path-8': 'на Восходящий путь 5',
      'bergen-trail.path-5': 'на Шипастые высоты',
      'cargo-ship.teleporter': 'на Телепорт',
      'forest.path-01-entrance': 'к Западному выходу',
      'forest.path-04-hostel': 'к Пещерному трактиру',
      'forest.path-08': 'на Резную тропу',
      'forest.path-10': 'к Старому додзё',
      'forest.path-12': 'в Храм вознесения',
      'heat.path-01-entrance': 'к Восточному входу',
      'heat.oasis.oasis-path-02': 'в Бордовый оазис',
      'heat.path-07': 'на Эстакаду',
      'heat.path-10': 'в Великий шрам',
      'heat.path-11': 'к Западному входу',
      'heat.dng-exterior': 'к Входу в храм',
      'heat-village.baki-2': 'на Рынок',
      'jungle.path-01-entrance': 'к Входу в Джунгли',
      'jungle.grove.grove-path-02': 'в Королевскую рощу',
      'jungle.clearing.clear-path-02': 'в Восточный Вирда Виль',
      'jungle.path-04-end': 'к Хризолитовому подходу',
      'jungle.infested.infested-path-03': 'на Южное заражённое болото',
      'jungle.dng.dng-crossing': 'к Обряду посвящения',
      'jungle-city.center': 'в Центрум',
      'rhombus-sqr.central-inner': 'в Cross Central',
      'rhombus-sqr.center-s': 'к Южной арке',
      'rhombus-sqr.shops-1': 'в Торговый квартал',
      'rhombus-sqr.central': 'на Балкон CrossCentral',
      'rookie-harbor.center': 'на Рыночная площадь',
      'rookie-harbor.teleporter': 'Арка новобранцев',
    };

    sc.MapAreaContainer.inject({
      onLandmarkPressed(landmark) {
        let show = sc.Dialogs.showYesNoDialog;
        sc.Dialogs.showYesNoDialog = function(text, icon, callback) {
          let mapName = CORRECT_MAP_NAMES_WITH_PREPOSITIONS[landmark.map.path];
          if (mapName != null) text = `Телепортироваться ${mapName}?`;
          let result = show.call(this, text, icon, callback);

          sc.Dialogs.showYesNoDialog = show;
          return result;
        };

        this.parent(landmark);
        sc.Dialogs.showYesNoDialog = show;
      },
    });
  });