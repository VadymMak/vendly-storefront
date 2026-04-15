import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/sections/HeroSection';
import SocialProofBar from '@/components/sections/SocialProofBar';
import HowItWorks from '@/components/sections/HowItWorks';
import PortfolioSection from '@/components/sections/PortfolioSection';
import IncludedSection from '@/components/sections/IncludedSection';
import PricingSection from '@/components/sections/PricingSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import FaqSection from '@/components/sections/FaqSection';
import CtaSection from '@/components/sections/CtaSection';
import OnboardingChat from '@/components/widgets/OnboardingChat';

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <HeroSection />
        <SocialProofBar />
        <HowItWorks />
        <PortfolioSection />
        <IncludedSection />
        <PricingSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
      <OnboardingChat />
    </>
  );
}
