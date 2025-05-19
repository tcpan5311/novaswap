import { useState } from 'react'

interface UseStepperOptions 
{
  totalSteps: number
  validateStep?: (step: number) => boolean
  resetOnStepChange?: (step: number) => void
}

export function UseStepper({totalSteps, validateStep, resetOnStepChange,}: UseStepperOptions) 
{
    const [activeStep, setActiveStep] = useState(1)
    const [highestStepVisited, setHighestStepVisited] = useState(1)

    const canSelectStep = (step: number) => highestStepVisited >= step

    const goToStep = (step: number) => 
    {
        if (step < 1 || step > totalSteps) return
        if (validateStep && !validateStep(step)) return
        setActiveStep(step)
        setHighestStepVisited((prev) => Math.max(prev, step))

        if (resetOnStepChange) 
        {
            resetOnStepChange(step)
        }
    }

    const onStepClick = (step: number) => 
    {
        if (canSelectStep(step)) 
            {
            setActiveStep(step)
        }
    }

  return {activeStep, highestStepVisited, canSelectStep, goToStep, onStepClick,}
}