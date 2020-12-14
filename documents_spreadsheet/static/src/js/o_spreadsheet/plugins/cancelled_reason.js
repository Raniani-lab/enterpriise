odoo.define("documents_spreadsheet.CommandResult", function (require) {
  "use strict";
  return {
    Success: 0, // should be imported from o-spreadsheet instead of redefined here
    FilterNotFound: 1000,
    DuplicatedFilterLabel: 1001,
    PivotCacheNotLoaded: 1002,
  };
});
