---
'@interlace/ui': minor
---

`MultiStepForm`: one form in a few steps with a last look before it is sent, for a booking, a sign-up or a request. Every `MultiStepFormStep` is part of one real `<form>`, kept in the page while hidden, so answers survive going back and the submit posts every field as `FormData`. Continue runs the step's native constraints and then its `validate`; the first problem takes focus and the message is read out. Done steps are buttons in the progress list, which is one line and a segmented bar in a narrow column and names every step from 32rem. `MultiStepFormSummary` lists the answers, each with a Change button back to the step that asked. Focus moves to each new step's heading ("Step 2 of 3"). The new step slides in from its side (200ms, mirrored in RTL) and is simply there under reduced motion. `useMultiStepForm` gives a step the form's state. Every word goes through `labels`.

Components: multi-step-form
