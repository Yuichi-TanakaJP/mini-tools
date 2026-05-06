const staleBaselineWarning =
  /^\[baseline-browser-mapping\] The data in this module is over two months old\./;

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = "true";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

const originalWarn = console.warn.bind(console);

console.warn = (...args) => {
  const message = args.map((arg) => String(arg)).join(" ");

  if (staleBaselineWarning.test(message)) {
    return;
  }

  originalWarn(...args);
};
