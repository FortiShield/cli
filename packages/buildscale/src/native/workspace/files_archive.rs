use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use std::ops::{Deref, DerefMut};
use std::path::Path;

use tracing::trace;

const BUILDSCALE_FILES_ARCHIVE: &str = "buildscale_files.buildscalew.";

#[derive(Archive, Serialize, Deserialize, PartialEq, Debug)]
#[archive(check_bytes)]
pub struct BuildscaleFileHashed(pub String, pub i64);

#[derive(Archive, Deserialize, Serialize, Debug, PartialEq)]
#[archive(check_bytes)]
pub struct BuildscaleFileHashes(HashMap<String, BuildscaleFileHashed>);

impl Deref for BuildscaleFileHashes {
    type Target = HashMap<String, BuildscaleFileHashed>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for BuildscaleFileHashes {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromIterator<(String, BuildscaleFileHashed)> for BuildscaleFileHashes {
    fn from_iter<T: IntoIterator<Item = (String, BuildscaleFileHashed)>>(iter: T) -> BuildscaleFileHashes {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        BuildscaleFileHashes(map)
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<BuildscaleFileHashes> {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(BUILDSCALE_FILES_ARCHIVE);
    if !archive_path.exists() {
        return None;
    }

    let bytes = std::fs::read(archive_path)
        .map_err(anyhow::Error::from)
        .and_then(|bytes| {
            // let archived = unsafe { rkyv::archived_root::<BuildscaleFilesArchive>(&bytes) };
            let archived = rkyv::check_archived_root::<BuildscaleFileHashes>(&bytes)
                .map_err(|_| anyhow!("invalid archive file"))?;
            <ArchivedBuildscaleFileHashes as Deserialize<BuildscaleFileHashes, Infallible>>::deserialize(
                archived,
                &mut rkyv::Infallible,
            )
            .map_err(anyhow::Error::from)
        });

    match bytes {
        Ok(archive) => {
            trace!("read archive in {:?}", now.elapsed());
            Some(archive)
        }
        Err(e) => {
            trace!("could not read files archive: {:?}", e);
            None
        }
    }
}

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: BuildscaleFileHashes) {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(BUILDSCALE_FILES_ARCHIVE);
    let result = rkyv::to_bytes::<_, 2048>(&files)
        .map_err(anyhow::Error::from)
        .and_then(|encoded| {
            std::fs::write(archive_path, encoded)?;
            Ok(())
        });

    match result {
        Ok(_) => {
            trace!("write archive in {:?}", now.elapsed());
        }
        Err(e) => {
            trace!("could not write files archive: {:?}", e);
        }
    }
}
