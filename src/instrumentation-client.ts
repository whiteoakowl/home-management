/**
 * Runs in the browser before the app becomes interactive. Fills in built-in features that
 * older browsers lack (iOS/iPadOS 15–16, Chrome 80+ on Android 8+), so buttons and pages work
 * there too. Each import only patches what's missing; modern browsers skip them.
 * Supported browsers are listed in package.json ("browserslist").
 */
import "core-js/actual/array/at";
import "core-js/actual/array/find-last";
import "core-js/actual/array/find-last-index";
import "core-js/actual/array/flat";
import "core-js/actual/array/flat-map";
import "core-js/actual/array/to-reversed";
import "core-js/actual/array/to-sorted";
import "core-js/actual/array/to-spliced";
import "core-js/actual/array/with";
import "core-js/actual/object/from-entries";
import "core-js/actual/object/group-by";
import "core-js/actual/object/has-own";
import "core-js/actual/map/group-by";
import "core-js/actual/promise/all-settled";
import "core-js/actual/promise/any";
import "core-js/actual/promise/with-resolvers";
import "core-js/actual/string/at";
import "core-js/actual/string/replace-all";
import "core-js/actual/structured-clone";
import "core-js/actual/global-this";
import "core-js/actual/queue-microtask";
