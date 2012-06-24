var handlebarsExtension = 'handlebars',
    handlebarsExtensionRegExp = new RegExp('\\.' + handlebarsExtension + '$'),
    layoutCidAttributeName = 'data-layout-cid',
    viewNameAttributeName = 'data-view-name',
    viewCidAttributeName = 'data-view-cid',
    callMethodAttributeName = 'data-call-method',
    viewPlaceholderAttributeName = 'data-view-tmp',
    modelCidAttributeName = 'data-model-cid',
    modelNameAttributeName = 'data-model-name',
    collectionCidAttributeName = 'data-collection-cid',
    collectionNameAttributeName = 'data-collection-name',
    collectionEmptyAttributeName = 'data-collection-empty',
    partialAttributeName = 'data-partial-name',
    oldBackboneView = Backbone.View,
    //android scrollTo(0, 0) shows url bar, scrollTo(0, 1) hides it
    minimumScrollYOffset = (navigator.userAgent.toLowerCase().indexOf("android") > -1) ? 1 : 0,
    ELEMENT_NODE_TYPE = 1;
    var renderTemplate;
