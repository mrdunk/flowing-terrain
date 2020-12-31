var gulp = require("gulp");
var browserify = require("browserify");
var source = require("vinyl-source-stream");
var tsify = require("tsify");
var sourcemaps = require("gulp-sourcemaps");
var buffer = require("vinyl-buffer");
var paths = {
  html: ["src/*.html", "src/*.css"],
  shaders: ["src/*.fx"],
  materials:["src/materialsLibrary/land/*"],
  assets: ["src/assets/*"]
};

gulp.task("copy-html", function() {
  return gulp.src(paths.html).pipe(gulp.dest("dist"));
});

gulp.task("copy-shaders", function() {
  return gulp.src(paths.shaders).pipe(gulp.dest("dist"));
});

gulp.task("copy-materials", function() {
  return gulp.src(paths.materials).pipe(gulp.dest("dist/materialsLibrary/land/"));
});

gulp.task("copy-assets", function() {
  return gulp.src(paths.assets).pipe(gulp.dest("dist/assets"));
});

gulp.task(
  "default",
  gulp.series(
    gulp.parallel("copy-html"),
    gulp.parallel("copy-assets"),
    gulp.parallel("copy-shaders"),
    gulp.parallel("copy-materials"),
    function ts() {
      return browserify({
        basedir: ".",
        debug: true,
        entries: ["src/main.ts"],
        cache: {},
        packageCache: {}
      })
        .plugin(tsify)
        .transform("babelify", {
          presets: ["es2015"],
          extensions: [".ts"]
        })
        .bundle()
        .pipe(source("bundle.js"))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(sourcemaps.write("./"))
        .pipe(gulp.dest("dist"));
    }
  )
);
