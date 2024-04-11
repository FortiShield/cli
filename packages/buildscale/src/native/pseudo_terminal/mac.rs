use std::collections::HashMap;

use tracing::trace;

use super::child_process::ChildProcess;
use super::os;
use super::pseudo_terminal::{create_pseudo_terminal, run_command};
use crate::native::logger::enable_logger;

#[napi]
pub struct RustPseudoTerminal {}

#[napi]
impl RustPseudoTerminal {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        enable_logger();
        Ok(Self {})
    }

    #[napi]
    pub fn run_command(
        &self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        quiet: Option<bool>,
    ) -> napi::Result<ChildProcess> {
        let pseudo_terminal = create_pseudo_terminal()?;
        run_command(&pseudo_terminal, command, command_dir, js_env, quiet)
    }

    /// This allows us to run a pseudoterminal with a fake node ipc channel
    /// this makes it possible to be backwards compatible with the old implementation
    #[napi]
    pub fn fork(
        &self,
        id: String,
        fork_script: String,
        pseudo_ipc_path: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        quiet: bool,
    ) -> napi::Result<ChildProcess> {
        let command = format!(
            "node {} {} {}",
            os::handle_path_space(fork_script),
            pseudo_ipc_path,
            id
        );

        trace!("buildscale_fork command: {}", &command);
        self.run_command(command, command_dir, js_env, Some(quiet))
    }
}