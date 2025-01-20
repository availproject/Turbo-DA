import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import CopySession from "./ui/copysession";

export default function Header() {
  return (
    <div className="sticky rounded-2xl top-0 md:mx-10 my-5 flex flex-row items-center justify-between bg-[#141414]/50 backdrop-blur-md p-5 z-50">
      <h1 className="text-white text-5xl flex-row items-center justify-center space-x-2 hidden md:flex">
        <p className="font-semibold font-sans"><span className="font-thin">Turbo</span>DA</p>
      </h1>
      <img src="/tokens/0xb1c3cb9b5e598d4e95a85870e7812b99f350982d.png" className="md:hidden flex w-8" alt="Logo"></img>
      <div className="flex flex-row items-center justify-center space-x-4 !text-white !font-mono">
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <CopySession/>
          <UserButton />
        </SignedIn>
      </div>
    </div>
  );
}
