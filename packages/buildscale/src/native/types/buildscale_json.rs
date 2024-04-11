use crate::native::types::JsInputs;
use std::collections::HashMap;

#[napi(object)]
/// Stripped version of the BuildscaleJson interface for use in rust
pub struct BuildscaleJson {
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
}
