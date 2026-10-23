//! Coordinate conversion only; grapheme navigation is a separate concern.

/// All offsets are zero based. UTF-8 offsets must be scalar boundaries.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PositionError {
    OutOfBounds,
    InsideCodePoint,
}

pub fn byte_to_utf16(source: &str, byte_offset: usize) -> Result<usize, PositionError> {
    if byte_offset > source.len() {
        return Err(PositionError::OutOfBounds);
    }
    if !source.is_char_boundary(byte_offset) {
        return Err(PositionError::InsideCodePoint);
    }
    Ok(source[..byte_offset].encode_utf16().count())
}

pub fn utf16_to_byte(source: &str, utf16_offset: usize) -> Result<usize, PositionError> {
    let mut units = 0;
    for (byte_offset, character) in source.char_indices() {
        if units == utf16_offset {
            return Ok(byte_offset);
        }
        units += character.len_utf16();
        if units > utf16_offset {
            return Err(PositionError::InsideCodePoint);
        }
    }
    if units == utf16_offset {
        Ok(source.len())
    } else {
        Err(PositionError::OutOfBounds)
    }
}

/// Returns a zero-based line and UTF-8 byte column. CRLF counts as one line break.
/// Only LF advances the line; CR remains a byte in the preceding line.
pub fn byte_to_line_column(
    source: &str,
    byte_offset: usize,
) -> Result<(usize, usize), PositionError> {
    byte_to_utf16(source, byte_offset)?;
    let prefix = &source[..byte_offset];
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count();
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    Ok((line, byte_offset - line_start))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_scalar_boundary_round_trips() {
        for source in ["", "ASCII", "한글😀끝", "e\u{301}", "👨‍👩‍👧‍👦", "a\r\nb\n"]
        {
            for byte_offset in (0..=source.len()).filter(|offset| source.is_char_boundary(*offset))
            {
                let utf16_offset = byte_to_utf16(source, byte_offset).unwrap();
                assert_eq!(utf16_to_byte(source, utf16_offset), Ok(byte_offset));
            }
        }
    }

    #[test]
    fn korean_and_astral_offsets_have_distinct_units() {
        assert_eq!(byte_to_utf16("한😀끝", 3), Ok(1));
        assert_eq!(byte_to_utf16("한😀끝", 7), Ok(3));
        assert_eq!(utf16_to_byte("한😀끝", 3), Ok(7));
    }

    #[test]
    fn rejects_partial_utf8_and_surrogate_positions() {
        assert_eq!(
            byte_to_utf16("한😀", 1),
            Err(PositionError::InsideCodePoint)
        );
        assert_eq!(
            utf16_to_byte("한😀", 2),
            Err(PositionError::InsideCodePoint)
        );
        assert_eq!(byte_to_utf16("", 1), Err(PositionError::OutOfBounds));
        assert_eq!(utf16_to_byte("", 1), Err(PositionError::OutOfBounds));
    }

    #[test]
    fn line_columns_use_bytes_and_support_trailing_newline() {
        let source = "한\r\n😀\n";
        assert_eq!(byte_to_line_column(source, 3), Ok((0, 3)));
        assert_eq!(byte_to_line_column(source, 5), Ok((1, 0)));
        assert_eq!(byte_to_line_column(source, 9), Ok((1, 4)));
        assert_eq!(byte_to_line_column(source, 10), Ok((2, 0)));
    }
}
