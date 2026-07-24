use std::fs::File;
use std::path::PathBuf;

use zip::ZipArchive;

pub fn unzip_file(archive_file: PathBuf, target_dir: PathBuf) -> Result<(), zip::result::ZipError> {
    let file = File::open(archive_file)?;
    let mut archive = ZipArchive::new(file)?;
    archive.extract(target_dir)
}
