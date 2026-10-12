// Explicit release-review exception for one byte-identical, previously approved
// school-sign restoration. Every other authoritative source stays immutable.
import {createHash} from 'node:crypto';

export const SCHOOL_SIGN='pages/assets/school/abvm-school-sign.webp';
export const TRUNCATED_MAIN_BLOB='5a3489367ffc277737aa64a6669662541bea95d3';
export const RESTORED_SIGN_BLOB='a2079e2643abaf0b89e595862c290155be3d7e0c';
export const APPROVED_SHA256='e0ba8feebe0ca8484492a85f686d64774ad6603a846469d7a29b584912d4ff11';

export function verifyApprovedSchoolSignRestoration({diff,mainBlob,previewBlob,bytes}) {
  const changed=String(diff||'').trim().split('\n').filter(Boolean);
  if(changed.length!==1 || changed[0]!==`M\t${SCHOOL_SIGN}`)
    throw new Error('protected diff must contain only the modified approved school-sign asset');
  if(mainBlob!==TRUNCATED_MAIN_BLOB)
    throw new Error('main school-sign baseline moved; re-review new main before approval');
  if(previewBlob!==RESTORED_SIGN_BLOB)
    throw new Error('reviewed sign Git blob differs from the exact approved restoration');
  if(!Buffer.isBuffer(bytes) || bytes.length!==24164)
    throw new Error('school-sign original has an unexpected length');
  if(bytes.toString('ascii',0,4)!=='RIFF' || bytes.toString('ascii',8,12)!=='WEBP' ||
      bytes.readUInt32LE(4)+8!==bytes.length)
    throw new Error('school-sign RIFF header is incomplete or invalid');
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==APPROVED_SHA256)
    throw new Error('school-sign image does not match the existing approved manifest');
  return Object.freeze({path:SCHOOL_SIGN,sha256:digest});
}
