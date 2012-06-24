_.extend(View.prototype, {
  scrollTo: function(x, y) {
    y = y || minimumScrollYOffset;
    function _scrollTo() {
      window.scrollTo(x, y);
    }
    if ($.os && $.os.ios) {
      // a defer is required for ios
      _.defer(_scrollTo);
    } else {
      _scrollTo();
    }
    return [x, y];
  },

  scrollToTop: function() {
    // android will use height of 1 because of minimumScrollYOffset
    return this.scrollTo(0, 0);
  }
});
