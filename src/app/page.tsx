import Topbar from "@/components/Topbar";
import Hero from "@/components/Hero";
import Copilot from "@/components/Copilot";

export default function Home() {
  return (
    <div className="app">
      <Topbar />
      <Hero />
      <Copilot />
      <div className="footer">
        ABAP Modernization Copilot · open simplification-item rules ·{" "}
        <span>built by Sneha Budhwani</span> · AI FDE Portfolio
      </div>
    </div>
  );
}
