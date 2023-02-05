var gulp = require('gulp');
var livereload = require('gulp-livereload');
var sass = require('gulp-sass');
var notifier = require('node-notifier');

gulp.task('reload-page', function() {
    livereload.reload();
});

gulp.task('reload-css', function() {
    gulp.src('./**/*.css')
        .pipe(livereload());
});

gulp.task('build-sass', function() {
    gulp.src('./sass/*.sass')
        .pipe(sass({
            outputStyle: 'expanded'
        }))
        .on('error', function(err) {
            notifier.notify({
                title: 'Gulp sass',
                message: err.formatted
            });
            console.log('Sass error in ' + err.file + '\n' + err.formatted);
        })
        .pipe(gulp.dest('./css/'));
});

gulp.task('watch', function() {
    livereload.listen();

    gulp.watch('./**/*.sass', ['build-sass']);
    gulp.watch('./**/*.css', ['reload-css']);
    gulp.watch('./**/*.{html,js,json,png,jpg,jpeg,svg}', ['reload-page']);
});