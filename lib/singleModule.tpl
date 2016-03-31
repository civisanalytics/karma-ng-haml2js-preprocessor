(function(module) {
    try {
      module = angular.module({{MODULE}});
    } catch (e) {
      module = angular.module({{MODULE}}, []);
    }
    module.run(function($templateCache) {
      $templateCache.put({{NAME}}, {{CONTENT}});
    });
})();
