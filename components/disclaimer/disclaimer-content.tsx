import React from 'react'

import { cn } from '@/lib/utils'

interface DisclaimerContentProps {
  isHideHeader?: boolean
}

export const DisclaimerContent = ({
  isHideHeader = false,
}: DisclaimerContentProps) => {
  return (
    <>
      {isHideHeader ? null : (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Disclaimer
            </h1>
            <p className="text-sm text-muted-foreground">
              Please read this disclaimer carefully before using the service
              operated by us.
            </p>
          </div>
        </div>
      )}
      <div
        className={cn(
          'flex flex-col items-center gap-4',
          isHideHeader ? '' : 'my-4'
        )}
      >
        {/* "streamed DIRECTLY from third party servers" was true when every
            source was an iframe the browser connected to itself. It stopped
            being true when the house player started proxying segments for
            browsers that cannot play the stream natively, and a sentence on
            the legal page that the network tab contradicts is worth less than
            no sentence at all — it is the first thing a complainant quotes
            back. Corrected to what the site actually does. Nothing is stored:
            the proxy passes bytes through and keeps none, which is the part
            that was, and remains, accurate. */}
        <p className="text-base text-muted-foreground">
          Reely.space is a free online movie and TV show streaming website that
          allows users to watch content sourced from third parties. Reely.space
          does not upload, own or store any movies, TV shows or video content
          displayed on the site, and keeps no copy of any of it. All content
          originates from external sources. Depending on the source and the
          browser, playback either connects to those sources directly or is
          relayed through Reely.space without being retained.
        </p>
        <p className="text-base text-muted-foreground">
          Reely.space has no control over the content quality, availability,
          copyright, legality or validity of the third party material viewed via
          the space. Reely.space cannot be held responsible for any streaming
          content on the space, whether authorized or unauthorized. Users are
          responsible for verifying they have the legal right to view any
          streamed content.
        </p>
        <p className="text-base text-muted-foreground">
          The operators of Reely.space make no warranties or representations
          about the site or any of the content, and assume no liability for any
          costs, damages or losses from the use of the site. By using
          Reely.space, you agree that access is provided “as is” at your own
          risk.
        </p>
        <div className="text-base text-muted-foreground">
          <p>Copyright Infringement:</p>
          Reely.space respects the intellectual property rights of others. Users
          are prohibited from using Reely.space to engage in copyright
          infringement or the unauthorized distribution of copyrighted content.
          Reely.space will promptly remove or disable access to any infringing
          content upon receipt of proper notification from the copyright holder.
        </div>
        <div className="text-base text-muted-foreground">
          <p>No Endorsement:</p>
          <p>
            The content accessible through Reely.space does not constitute an
            endorsement by the website operators of any third party content
            providers, services, or products. References and links to third
            party content are provided for informational and entertainment
            purposes only.
          </p>
        </div>
        <div className="text-base text-muted-foreground">
          <p>Age Restricted Content:</p>
          <p>
            Reely.space does not knowingly collect or distribute content
            considered obscene or harmful to minors as defined by applicable
            law. However, Reely.space has no control over third party content
            and some material accessible through Reely.space may be
            inappropriate for minors. Parents are advised to supervise minors
            using the service.
          </p>
        </div>
        <div className="text-base text-muted-foreground">
          <p>No Warranties:</p>
          <p>
            Reely.space provides access to third party content on an “as is”
            basis without warranties of any kind, express or implied. The
            website operators make no guarantees regarding the accuracy,
            currency, suitability, completeness, usefulness, safety or
            intellectual property rights related to any accessible content.
          </p>
        </div>
        <div className="text-base text-muted-foreground">
          <p>Limitation of Liability:</p>
          <p>
            In no event shall Reely.space be liable for any direct, indirect,
            punitive, incidental or consequential damages arising out of the
            use, inability to use, or unavailability of the service or any
            content accessible on the site. Users agree to fully indemnify and
            hold harmless Reely.space and its operators from any claims arising
            from use of the service.
          </p>
        </div>
      </div>
    </>
  )
}
