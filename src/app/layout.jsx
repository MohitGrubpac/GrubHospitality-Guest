import { Inter, Orbitron } from "next/font/google";
import "@/app/globals.css";
import "@/styles/globals.css";
import MainProvider from "@/component/providers/MainProvider";
import DesktopPreview from "@/component/ui/DesktopPreview";
import AppHeader from "@/component/ui/AppHeader";
import BottomDock from "@/component/ui/BottomDock";
import AuthGate from "@/component/ui/AuthGate";

const inter = Inter({
	variable: "--font-primary",
	subsets: ["latin"],
});

const orbitron = Orbitron({
	variable: "--font-orbitron",
	subsets: ["latin"],
	weight: "500",
});

export const metadata = {
	title: "Grubpac Hospitality - Hotel Food Booking",
	description: "Browse hotel menus and order food directly from your phone.",
	icons: {
		icon: "/logomark.svg",
	},
};

export const viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}) {
	return (
		<html lang="en">
			<body
				className={`${inter.variable} ${orbitron.variable} antialiased`}
			>
				<MainProvider>
					<DesktopPreview />
					<AuthGate>
						<AppHeader />
						{children}
						<BottomDock />
					</AuthGate>
				</MainProvider>
			</body>
		</html>
	);
}