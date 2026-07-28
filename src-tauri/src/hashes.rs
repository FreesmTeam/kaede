use std::fmt::Write;

use md5::Md5;
use sha2::{Digest, Sha256};

pub(crate) fn lowercase_hex(bytes: &[u8]) -> String {
    let mut hex = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        let _ = write!(hex, "{:02x}", byte);
    }

    hex
}

pub fn md5_hex(bytes: &[u8]) -> String {
    lowercase_hex(&Md5::digest(bytes))
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    lowercase_hex(&Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::{md5_hex, sha256_hex};

    #[test]
    fn hashes_exact_bytes_to_lowercase_hex() {
        assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(&[0, 127, 128, 255]),
            "89273d2f70b93285bb7ddb4bcee86a5347ca7159352e3cbdd20c23e9d1e507d3"
        );
    }
}
