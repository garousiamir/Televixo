<?php
/**
 * Builds release archives (run after `npm ci && npm run build`):
 *   php bin/package.php
 *
 * dist/televixo.zip               installable plugin (single televixo/ dir)
 * dist/televixo-full-<ver>.zip    installable zip + docs + changelog + licenses + build sources
 */

$root    = dirname( __DIR__ );
$version = preg_match( "/define\( 'TELEVIXO_VERSION', '([^']+)' \)/", file_get_contents( "$root/televixo/televixo.php" ), $m ) ? $m[1] : '0.0.0';
$dist    = "$root/dist";
@mkdir( $dist, 0755, true );

function files_under( string $dir, array $exclude ): array {
	$out = array();
	$it  = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ) );
	foreach ( $it as $f ) {
		$rel = substr( $f->getPathname(), strlen( $dir ) + 1 );
		foreach ( $exclude as $pattern ) {
			if ( fnmatch( $pattern, $rel ) ) {
				continue 2;
			}
		}
		$out[ $rel ] = $f->getPathname();
	}
	ksort( $out );
	return $out;
}

function zip_files( string $target, array $map ): void {
	@unlink( $target );
	$zip = new ZipArchive();
	if ( true !== $zip->open( $target, ZipArchive::CREATE ) ) {
		fwrite( STDERR, "Cannot create $target\n" );
		exit( 1 );
	}
	foreach ( $map as $name => $path ) {
		$zip->addFile( $path, $name );
		$zip->setMtimeName( $name, 1761868800 ); // Fixed mtime for reproducible archives.
	}
	$zip->close();
}

foreach ( array( 'assets/build/widget.js', 'assets/build/admin.js', 'assets/build/widget.asset.php', 'languages/televixo.pot' ) as $required ) {
	if ( ! is_file( "$root/televixo/$required" ) ) {
		fwrite( STDERR, "Missing $required. Run npm ci && npm run build first.\n" );
		exit( 1 );
	}
}

$plugin = array();
foreach ( files_under( "$root/televixo", array( '*.map', '.DS_Store', '*/.gitkeep' ) ) as $rel => $path ) {
	$plugin[ "televixo/$rel" ] = $path;
}
zip_files( "$dist/televixo.zip", $plugin );

$full = array( 'televixo.zip' => "$dist/televixo.zip", 'CHANGELOG.md' => "$root/CHANGELOG.md", 'README.md' => "$root/README.md", 'LICENSE.txt' => "$root/televixo/LICENSE.txt" );
foreach ( files_under( "$root/docs", array( 'visual/*', '*.json' ) ) as $rel => $path ) {
	$full[ "documentation/$rel" ] = $path;
}
foreach ( array( 'assets-src', 'bin', 'tests' ) as $dir ) {
	foreach ( files_under( "$root/$dir", array() ) as $rel => $path ) {
		$full[ "source/$dir/$rel" ] = $path;
	}
}
foreach ( array( 'package.json', 'package-lock.json', 'composer.json', 'composer.lock', 'tsconfig.json', 'phpunit.xml.dist' ) as $f ) {
	$full[ "source/$f" ] = "$root/$f";
}
zip_files( "$dist/televixo-full-$version.zip", $full );

foreach ( array( 'televixo.zip', "televixo-full-$version.zip" ) as $f ) {
	printf( "%s  %s  %d bytes\n", hash_file( 'sha256', "$dist/$f" ), $f, filesize( "$dist/$f" ) );
}
