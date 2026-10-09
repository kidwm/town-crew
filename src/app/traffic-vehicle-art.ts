const icon = (body: string, extra: string) => `<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 17h30v15H3Z" fill="${body}"/><path d="M33 14h9l5 10v8H33Z" fill="${body}"/><path d="M35 17h5l4 7h-9Z" fill="#b6dcd9"/>${extra}<circle cx="11" cy="33" r="5" fill="#526c66"/><circle cx="38" cy="33" r="5" fill="#526c66"/></svg>`;
export const icons = {
  police: icon('#eee8d5', '<path d="M3 27h43" stroke="#749aaf" stroke-width="5"/><path d="M18 13h12" stroke="#d58d7b" stroke-width="4"/>'),
  tow: icon('#e3b360', '<path d="M2 25h30v5H2Z" fill="#7f9b95"/><path d="M8 14h18v10H8Z" fill="#d8947e"/><path d="M11 10h11v6H11Z" fill="#b3d6ce"/>'),
  sweeper: icon('#9aba9d', '<path d="M6 13h23v14H6Z" fill="#b4c8a7"/><path d="M8 17h18m-18 4h18" stroke="#809d8d" stroke-width="2"/><ellipse cx="29" cy="34" rx="9" ry="3" fill="#d9bb7a"/>'),
  ambulance: icon('#f0e9d5', '<path d="M3 29h43M14 21h10m-5-5v10" stroke="#80ad9e" stroke-width="4"/><path d="M34 11h8" stroke="#d89779" stroke-width="3"/>'),
};
export const liftIcon = icon('#e3b360', '<path d="M29 18 11 5 3 23" fill="none" stroke="#809b93" stroke-width="4"/><path d="M3 23v5h12" fill="none" stroke="#eac87e" stroke-width="3"/>');
